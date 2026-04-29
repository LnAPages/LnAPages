import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { inferGalleryKind, normalizeGalleryTags } from '@shared/galleryUtils';
import { CANONICAL_CATEGORY_SLUGS } from '@shared/constants';
import type { GalleryItem, GallerySourceConfig } from '@/types';
import type { Service } from '@/types';
import { api } from '@/lib/api';
import { FocalPointModal } from '@/components/FocalPointModal';

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const ACCEPT = 'image/*,video/mp4,video/webm,video/quicktime';
const DRIVE_PREFIX = 'drive:';

type FileState = {
  id: string;
  file: File;
  title: string;
  alt_text: string;
  tags: string[];
  tagInput: string;
  sort_order: number;
  width: string;
  height: string;
  progress: number;
  uploading: boolean;
  error: string | null;
  done: boolean;
};

type EditDraft = {
  selected: boolean;
  title: string;
  alt: string;
  category: string;
  tags: string[];
  sort_order: number;
  saving: boolean;
  error: string | null;
};

function isAccepted(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type);
}

function makeFileState(file: File): FileState {
  return {
    id: `${Date.now()}-${file.name}`,
    file,
    title: '',
    alt_text: '',
    tags: ['general'],
    tagInput: '',
    sort_order: 0,
    width: '',
    height: '',
    progress: 0,
    uploading: false,
    error: null,
    done: false,
  };
}

type PresignResponse = {
  url: string;
  key: string;
  headers: Record<string, string>;
};

type GalleryItemWithTags = GalleryItem & { tags?: string[] };

function tagsForItem(item: GalleryItemWithTags): string[] {
  return normalizeGalleryTags(item.tags ?? [item.category ?? 'general']);
}

type AdminGalleryItem = GalleryItemWithTags & { selected?: boolean };

function getDriveId(item: GalleryItem): string | null {
  if (typeof item.id === 'string' && item.id.startsWith(DRIVE_PREFIX)) return item.id.slice(DRIVE_PREFIX.length);
  if (item.source !== 'drive') return null;
  const fromUrl = (item.r2_key ?? '').match(/[?&]id=([a-zA-Z0-9_-]{10,})/i);
  return fromUrl?.[1] ?? null;
}

function getEditKey(item: GalleryItem): string | null {
  if (typeof item.id === 'number') return `r2:${item.id}`;
  const driveId = getDriveId(item);
  if (driveId) return `${DRIVE_PREFIX}${driveId}`;
  return null;
}

function uploadWithProgress(
  file: File,
  fields: Pick<FileState, 'title' | 'alt_text' | 'tags' | 'sort_order' | 'width' | 'height'>,
  onProgress: (pct: number) => void,
): Promise<GalleryItem> {
  return new Promise((resolve, reject) => {
    const kind = inferGalleryKind(file.type, file.name);
    api
      .post<PresignResponse>('/admin/gallery/presign', {
        filename: file.name,
        contentType: file.type || undefined,
        kind,
      })
      .then((presign) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener('load', async () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(`Upload failed (${xhr.status})`));
            return;
          }
          try {
            const normalizedTags = normalizeGalleryTags(fields.tags);
            const created = await api.post<GalleryItem>('/gallery', {
              key: presign.key,
              kind,
              width: fields.width ? Number(fields.width) : null,
              height: fields.height ? Number(fields.height) : null,
              title: fields.title,
              altText: fields.alt_text,
              tags: normalizedTags,
              category: normalizedTags[0],
              sortOrder: fields.sort_order,
              mimeType: file.type || undefined,
            });
            resolve(created);
          } catch (error) {
            reject(error instanceof Error ? error : new Error('Upload succeeded but saving gallery metadata failed'));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.open('PUT', presign.url);
        for (const [header, value] of Object.entries(presign.headers ?? {})) {
          xhr.setRequestHeader(header, value);
        }
        xhr.send(file);
      })
      .catch((error) => reject(error instanceof Error ? error : new Error('Failed to request upload URL')));
  });
}

export default function AdminGallery() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<FileState[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});
  const [focalItem, setFocalItem] = useState<{ id: number; url: string; fx: number; fy: number } | null>(null);
  const [saveSourceMessage, setSaveSourceMessage] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'selected' | 'unselected'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin', 'gallery'],
    queryFn: () => api.get<AdminGalleryItem[]>('/admin/gallery'),
  });
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<Service[]>('/services'),
  });
  const { data: sourceConfig } = useQuery({
    queryKey: ['admin', 'gallery-source'],
    queryFn: () => api.get<GallerySourceConfig>('/admin/gallery/source'),
  });
  const [sourceDraft, setSourceDraft] = useState<Partial<GallerySourceConfig>>({});
  const sourceMode = sourceDraft.mode ?? sourceConfig?.mode ?? 'r2';
  const driveFolderUrl = sourceDraft.driveFolderUrl ?? sourceConfig?.driveFolderUrl ?? '';

  const saveSourceMutation = useMutation({
    mutationFn: () =>
      api.put<GallerySourceConfig>('/admin/gallery/source', {
        mode: sourceMode,
        driveFolderUrl: driveFolderUrl.trim() || undefined,
      }),
    onSuccess: (next) => {
      setSourceDraft({});
      setSaveSourceMessage('Gallery source saved');
      qc.setQueryData(['admin', 'gallery-source'], next);
      qc.invalidateQueries({ queryKey: ['gallery'] });
      qc.invalidateQueries({ queryKey: ['admin', 'gallery'] });
      qc.invalidateQueries({ queryKey: ['admin', 'gallery-source'] });
    },
    onError: (error: unknown) => {
      setSaveSourceMessage(error instanceof Error ? error.message : 'Failed to save gallery source');
    },
  });

  const { data: tagStats = [] } = useQuery({
    queryKey: ['gallery', 'tags'],
    queryFn: () => api.get<Array<{ tag: string; count: number }>>('/gallery/tags'),
  });

  const invalidateGallery = () => {
    qc.invalidateQueries({ queryKey: ['gallery'] });
    qc.invalidateQueries({ queryKey: ['admin', 'gallery'] });
  };

  const serviceTagOptions = services.map((service) => ({ value: service.slug, label: service.name }));
  const serviceTagValues = new Set(serviceTagOptions.map((option) => option.value));
  const selectedCount = items.filter((item) => item.selected === true).length;
  const filteredItems = items.filter((item) => {
    if (visibilityFilter === 'all') return true;
    if (visibilityFilter === 'selected') return item.selected === true;
    return item.selected !== true;
  });

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: FileState[] = [];
    for (const f of Array.from(files)) {
      const state = makeFileState(f);
      if (!isAccepted(f)) {
        next.push({ ...state, error: `Unsupported file type: ${f.type || 'unknown'}` });
      } else if (f.size > MAX_BYTES) {
        next.push({ ...state, error: `Exceeds 200 MB limit (${(f.size / 1024 / 1024).toFixed(1)} MB)` });
      } else {
        next.push(state);
      }
    }
    setQueue((q) => [...q, ...next]);
  }, []);

  const updateQueue = (id: string, patch: Partial<FileState>) =>
    setQueue((q) => q.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const removeQueue = (id: string) => setQueue((q) => q.filter((f) => f.id !== id));

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const uploadFile = async (fs: FileState) => {
    if (fs.error) return;
    updateQueue(fs.id, { uploading: true, error: null });
    try {
      await uploadWithProgress(
        fs.file,
        { title: fs.title, alt_text: fs.alt_text, tags: fs.tags, sort_order: fs.sort_order, width: fs.width, height: fs.height },
        (pct) => updateQueue(fs.id, { progress: pct }),
      );
      updateQueue(fs.id, { done: true, uploading: false, progress: 100 });
      invalidateGallery();
    } catch (e) {
      updateQueue(fs.id, { error: e instanceof Error ? e.message : 'Upload failed', uploading: false });
    }
  };

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete<{ id: number }>(`/gallery/${id}`),
    onSuccess: invalidateGallery,
  });

  const handleDelete = async (item: GalleryItem) => {
    if (typeof item.id !== 'number') return;
    if (!confirm(`Delete "${item.title || item.r2_key}"? This cannot be undone.`)) return;
    await deleteMut.mutateAsync(item.id);
  };

  const startEdit = (item: GalleryItem) => {
    const key = getEditKey(item);
    if (!key) return;
    setEditingKey(key);
    const currentCategory = item.category ?? '';
    const canonicalCategory = CANONICAL_CATEGORY_SLUGS.includes(currentCategory as (typeof CANONICAL_CATEGORY_SLUGS)[number])
      ? (currentCategory as (typeof CANONICAL_CATEGORY_SLUGS)[number])
      : CANONICAL_CATEGORY_SLUGS[0];
    setEditDrafts((d) => ({
      ...d,
      [key]: {
        selected: item.selected === true,
        title: item.title ?? '',
        alt: item.alt_text ?? '',
        category: canonicalCategory,
        tags: tagsForItem(item),
        sort_order: item.sort_order ?? 0,
        saving: false,
        error: null,
      },
    }));
  };

  const patchEditDraft = (key: string, patch: Partial<EditDraft>) =>
    setEditDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }));

  const saveEdit = async (key: string) => {
    const draft = editDrafts[key];
    if (!draft) return;
    patchEditDraft(key, { saving: true, error: null });
    try {
      const tags = normalizeGalleryTags(draft.tags).filter((tag) => serviceTagValues.has(tag));
      const category = draft.category.trim();
      const payload = {
        selected: draft.selected,
        title: draft.title,
        alt: draft.alt,
        category,
        tags,
        sort_order: draft.sort_order,
      };
      if (key.startsWith('r2:')) {
        await api.patch(`/gallery/${key.slice('r2:'.length)}`, { ...payload, alt_text: draft.alt });
      } else if (key.startsWith(DRIVE_PREFIX)) {
        await api.put('/admin/gallery/overrides', { driveId: key.slice(DRIVE_PREFIX.length), override: payload });
      }
      invalidateGallery();
      setEditingKey(null);
    } catch (e) {
      patchEditDraft(key, { saving: false, error: e instanceof Error ? e.message : 'Save failed' });
    }
  };

  const pendingCount = queue.filter((f) => !f.done && !f.error).length;
  const toggleSelectedMutation = useMutation({
    mutationFn: ({ itemKey, selected }: { itemKey: string; selected: boolean }) =>
      api.put('/admin/gallery/overrides', { itemKey, override: { selected } }),
    onSuccess: invalidateGallery,
  });

  const bulkFocalMutation = useMutation({
    mutationFn: (focalItems: Array<{ id: number; focal_x: number; focal_y: number }>) =>
      api.post('/admin/gallery/bulk-focal', { items: focalItems }),
    onSuccess: () => {
      invalidateGallery();
      setBulkMessage(`Focal points updated for ${selectedIds.size} image(s) ✓`);
      setTimeout(() => setBulkMessage(null), 3000);
    },
  });

  const handleBulkCenter = () => {
    const focalItems = [...selectedIds].map((id) => ({ id, focal_x: 0.5, focal_y: 0.5 }));
    bulkFocalMutation.mutate(focalItems);
  };

  const toggleBulkSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const ids = filteredItems
      .map((item) => (typeof item.id === 'number' ? item.id : null))
      .filter((id): id is number => id !== null);
    setSelectedIds(new Set(ids));
  };

  const clearSelection = () => setSelectedIds(new Set());

  return (
    <section className='space-y-6 p-4'>
      <header>
        <h1 className='text-xl font-semibold'>Gallery</h1>
        <p className='text-sm text-[hsl(var(--muted-foreground))]'>Upload and manage gallery images and videos.</p>
        <p className='mt-1 text-xs text-[hsl(var(--muted-foreground))]'>Public: {selectedCount} / {items.length} selected</p>
        <div className='mt-2 flex gap-2'>
          {(['all', 'selected', 'unselected'] as const).map((value) => (
            <button
              key={value}
              type='button'
              onClick={() => setVisibilityFilter(value)}
              className={`rounded border px-2 py-1 text-xs ${
                visibilityFilter === value ? 'border-emerald-500 text-emerald-300' : 'border-border text-[hsl(var(--muted-foreground))]'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </header>

      <div className='space-y-3 rounded border border-border bg-[hsl(var(--surface)/0.4)] p-4'>
        <h2 className='text-sm font-semibold text-[hsl(var(--foreground))]'>Image source</h2>
        <p className='text-xs text-[hsl(var(--muted-foreground))]'>
          Choose where public gallery images are loaded from.
        </p>
        <div className='flex flex-wrap gap-2'>
          {(['r2', 'drive', 'mixed'] as const).map((mode) => (
            <button
              key={mode}
              type='button'
              onClick={() => {
                setSourceDraft((current) => ({ ...current, mode }));
                setSaveSourceMessage(null);
              }}
              className={`rounded border px-3 py-1 text-xs uppercase tracking-[0.14em] ${
                sourceMode === mode
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                  : 'border-border text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <label className='block text-xs'>
          <span className='block text-[hsl(var(--muted-foreground))]'>Public Google Drive folder URL</span>
          <input
            value={driveFolderUrl}
            onChange={(e) => {
              setSourceDraft((current) => ({ ...current, driveFolderUrl: e.target.value }));
              setSaveSourceMessage(null);
            }}
            placeholder='https://drive.google.com/drive/folders/...'
            className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
          />
        </label>
        <div className='flex items-center justify-between gap-3'>
          <p className='text-[11px] text-[hsl(var(--muted-foreground))]'>
            Required for <span className='font-medium text-[hsl(var(--muted-foreground))]'>drive</span> and <span className='font-medium text-[hsl(var(--muted-foreground))]'>mixed</span> mode.
          </p>
          <button
            type='button'
            onClick={() => saveSourceMutation.mutate()}
            disabled={saveSourceMutation.isPending}
            className='btn-accent px-3 py-1 text-xs font-medium disabled:opacity-50'
          >
            {saveSourceMutation.isPending ? 'Saving…' : 'Save source'}
          </button>
        </div>
        {sourceConfig?.lastSyncedAt ? (
          <p className='text-[11px] text-[hsl(var(--muted-foreground))]'>Last Drive sync: {new Date(sourceConfig.lastSyncedAt).toLocaleString()}</p>
        ) : null}
        {saveSourceMessage ? (
          <p className={`text-xs ${saveSourceMutation.isError ? 'text-red-400' : 'text-emerald-400'}`}>{saveSourceMessage}</p>
        ) : null}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-[hsl(var(--border))]'
        }`}
      >
        <p className='text-sm text-[hsl(var(--muted-foreground))]'>Drag and drop images or videos here, or</p>
        <button
          type='button'
          onClick={() => fileInputRef.current?.click()}
          className='mt-2 btn-accent px-4 py-2 text-sm font-medium'
        >
          Browse files
        </button>
        <p className='mt-1 text-xs text-[hsl(var(--muted-foreground))]'>Images (any format) · MP4, WebM, MOV · Max 200 MB per file</p>
        <input
          ref={fileInputRef}
          type='file'
          multiple
          accept={ACCEPT}
          className='hidden'
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Upload queue */}
      {queue.length > 0 && (
        <div className='space-y-3'>
          <h2 className='text-sm font-semibold text-[hsl(var(--muted-foreground))]'>
            Upload queue ({pendingCount} pending)
          </h2>
          {queue.map((fs) => (
            <div key={fs.id} className='rounded border border-border bg-[hsl(var(--surface)/0.4)] p-3 space-y-2'>
              <div className='flex items-center gap-2'>
                <span className='flex-1 truncate text-sm font-medium'>{fs.file.name}</span>
                <span className='text-xs text-[hsl(var(--muted-foreground))]'>{(fs.file.size / 1024 / 1024).toFixed(1)} MB</span>
                {fs.done && <span className='text-xs font-medium text-emerald-400'>✓ Uploaded</span>}
                <button
                  type='button'
                  onClick={() => removeQueue(fs.id)}
                  aria-label='Remove'
                  className='rounded px-1 text-[hsl(var(--muted-foreground))] hover:text-red-400'
                >
                  ×
                </button>
              </div>

              {fs.error && <p className='text-xs text-red-400'>{fs.error}</p>}

              {!fs.done && !fs.error && (
                <>
                  <div className='grid grid-cols-2 gap-2 md:grid-cols-3'>
                    <label className='text-xs'>
                      <span className='block text-[hsl(var(--muted-foreground))]'>Title</span>
                      <input
                        className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                        value={fs.title}
                        onChange={(e) => updateQueue(fs.id, { title: e.target.value })}
                      />
                    </label>
                    <label className='text-xs'>
                      <span className='block text-[hsl(var(--muted-foreground))]'>Alt text</span>
                      <input
                        className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                        value={fs.alt_text}
                        onChange={(e) => updateQueue(fs.id, { alt_text: e.target.value })}
                      />
                    </label>
                    <label className='text-xs'>
                      <span className='block text-[hsl(var(--muted-foreground))]'>Tags</span>
                      <div className='mt-1 rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1'>
                        <div className='mb-1 flex flex-wrap gap-1'>
                          {fs.tags.map((tag) => (
                            <button
                              key={tag}
                              type='button'
                              className='rounded bg-[hsl(var(--surface-3))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--foreground))]'
                              onClick={() => updateQueue(fs.id, { tags: fs.tags.filter((value) => value !== tag) })}
                            >
                              {tag} ×
                            </button>
                          ))}
                        </div>
                        <input
                          className='w-full bg-transparent text-sm outline-none'
                          placeholder='Type tag and press Enter'
                          list='gallery-tag-suggestions'
                          value={fs.tagInput}
                          onChange={(e) => updateQueue(fs.id, { tagInput: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter' && e.key !== ',') return;
                            e.preventDefault();
                            const next = fs.tagInput.trim();
                            if (!next) return;
                            updateQueue(fs.id, {
                              tags: normalizeGalleryTags([...fs.tags, next]),
                              tagInput: '',
                            });
                          }}
                        />
                      </div>
                    </label>
                    <label className='text-xs'>
                      <span className='block text-[hsl(var(--muted-foreground))]'>Sort order</span>
                      <input
                        type='number'
                        min={0}
                        className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                        value={fs.sort_order}
                        onChange={(e) => updateQueue(fs.id, { sort_order: Number(e.target.value) })}
                      />
                    </label>
                    <label className='text-xs'>
                      <span className='block text-[hsl(var(--muted-foreground))]'>Width (px, optional)</span>
                      <input
                        type='number'
                        min={0}
                        className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                        value={fs.width}
                        onChange={(e) => updateQueue(fs.id, { width: e.target.value })}
                      />
                    </label>
                    <label className='text-xs'>
                      <span className='block text-[hsl(var(--muted-foreground))]'>Height (px, optional)</span>
                      <input
                        type='number'
                        min={0}
                        className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                        value={fs.height}
                        onChange={(e) => updateQueue(fs.id, { height: e.target.value })}
                      />
                    </label>
                  </div>

                  {fs.uploading ? (
                    <div className='space-y-1'>
                      <div className='flex justify-between text-xs text-[hsl(var(--muted-foreground))]'>
                        <span>Uploading…</span>
                        <span>{fs.progress}%</span>
                      </div>
                      <div className='h-1.5 w-full rounded bg-[hsl(var(--surface-3))]'>
                        <div
                          className='h-1.5 rounded bg-blue-500 transition-all'
                          style={{ width: `${fs.progress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className='flex justify-end'>
                      <button
                        type='button'
                        onClick={() => uploadFile(fs)}
                        className='btn-accent px-3 py-1 text-xs font-medium'
                      >
                        Upload
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Existing items */}
      <div className='space-y-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h2 className='text-sm font-semibold text-[hsl(var(--muted-foreground))]'>Gallery items ({filteredItems.length})</h2>
          <div className='flex gap-2'>
            <button type='button' className='rounded border border-border px-2 py-1 text-xs' onClick={selectAllVisible}>select all visible</button>
            {selectedIds.size > 0 && (
              <button type='button' className='rounded border border-border px-2 py-1 text-xs text-[hsl(var(--muted-foreground))]' onClick={clearSelection}>clear ({selectedIds.size})</button>
            )}
          </div>
        </div>

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div className='flex flex-wrap items-center gap-2 rounded border border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--accent)/0.08)] px-3 py-2'>
            <span className='text-xs font-medium'>{selectedIds.size} selected</span>
            <button
              type='button'
              className='rounded border border-border px-2 py-1 text-xs hover:bg-[hsl(var(--surface-2))]'
              onClick={handleBulkCenter}
              disabled={bulkFocalMutation.isPending}
              title='Set focal point to center (0.5, 0.5) for all selected images'
            >
              {bulkFocalMutation.isPending ? 'Updating…' : '⊙ center focal points'}
            </button>
            <button
              type='button'
              className='rounded border border-border px-2 py-1 text-xs hover:bg-[hsl(var(--surface-2))]'
              onClick={() => {
                const firstId = [...selectedIds][0];
                if (firstId) navigate(`/admin/gallery/${firstId}/crop`);
              }}
            >
              ✂ crop first selected
            </button>
            {bulkMessage && <span className='text-xs text-emerald-400'>{bulkMessage}</span>}
          </div>
        )}

        {isLoading && <p className='text-sm text-[hsl(var(--muted-foreground))]'>Loading…</p>}
        {!isLoading && filteredItems.length === 0 && (
          <p className='rounded border border-dashed border-border p-6 text-center text-sm text-[hsl(var(--muted-foreground))]'>
            No gallery items yet.
          </p>
        )}
        <ul className='space-y-2'>
          {filteredItems.map((item) => {
            const itemId = typeof item.id === 'number' ? item.id : null;
            const editKey = getEditKey(item);
            const kind = (item as GalleryItem & { kind?: string }).kind;
            const source = item.source ?? 'r2';
            const isEditing = !!(editKey && editingKey === editKey && editDrafts[editKey]);
            const draft = editKey ? editDrafts[editKey] : undefined;
            const isDriveOnly = source === 'drive' && itemId === null;
            const isBulkSelected = itemId !== null && selectedIds.has(itemId);
            return (
              <li key={itemId ?? item.r2_key} className={`rounded border p-3 ${isBulkSelected ? 'border-[hsl(var(--accent)/0.6)] bg-[hsl(var(--accent)/0.06)]' : 'border-border bg-[hsl(var(--surface)/0.4)]'}`}>
                <div className='flex gap-3'>
                  {/* Bulk checkbox */}
                  {itemId !== null && (
                    <label className='flex items-start pt-1'>
                      <input
                        type='checkbox'
                        className='mt-0.5'
                        checked={isBulkSelected}
                        onChange={() => toggleBulkSelect(itemId)}
                        aria-label={`Select ${item.title || item.r2_key}`}
                      />
                    </label>
                  )}
                  {/* Thumbnail */}
                  <div className='h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-[hsl(var(--surface-2))]'>
                    {kind === 'video' ? (
                      <div className='flex h-full w-full items-center justify-center text-xs text-[hsl(var(--muted-foreground))]'>
                        VIDEO
                      </div>
                    ) : (
                      <img
                        src={item.thumb_url ?? item.r2_key}
                        alt={item.alt_text || item.title}
                        className='h-full w-full object-cover'
                        loading='lazy'
                      />
                    )}
                  </div>

                  <div className='flex-1 min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='truncate text-sm font-medium'>{item.title || item.r2_key}</span>
                      {kind && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            kind === 'video' ? 'bg-purple-700 text-purple-100' : 'bg-blue-700 text-blue-100'
                          }`}
                        >
                          {kind}
                        </span>
                      )}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                          source === 'drive' ? 'bg-amber-700/70 text-amber-100' : 'bg-[hsl(var(--surface-3))] text-[hsl(var(--foreground))]'
                        }`}
                      >
                        {source}
                      </span>
                      <label className='ml-auto inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]'>
                        <input
                          type='checkbox'
                          checked={item.selected === true}
                          disabled={toggleSelectedMutation.isPending || !editKey}
                          onChange={(event) => {
                            toggleSelectedMutation.mutate({ itemKey: editKey!, selected: event.target.checked });
                          }}
                        />
                        Public
                      </label>
                    </div>
                    <p className='text-xs text-[hsl(var(--muted-foreground))]'>
                      {tagsForItem(item).join(', ')} · sort:{' '}
                      {item.sort_order}
                    </p>

                    {isEditing && draft && editKey && (
                      <div className='mt-2 space-y-2'>
                        <div className='grid grid-cols-2 gap-2'>
                          <label className='text-xs'>
                            <span className='block text-[hsl(var(--muted-foreground))]'>Title</span>
                            <input
                              className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                              value={draft.title}
                                onChange={(e) => patchEditDraft(editKey, { title: e.target.value })}
                            />
                          </label>
                          <label className='text-xs'>
                            <span className='block text-[hsl(var(--muted-foreground))]'>Alt text</span>
                            <input
                              className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                              value={draft.alt}
                              onChange={(e) => patchEditDraft(editKey, { alt: e.target.value })}
                            />
                          </label>
                          <label className='text-xs'>
                            <span className='block text-[hsl(var(--muted-foreground))]'>Category</span>
                            <select
                              className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                              value={draft.category}
                              onChange={(e) => patchEditDraft(editKey, { category: e.target.value })}
                            >
                              {CANONICAL_CATEGORY_SLUGS.map((value) => (
                                <option key={value} value={value}>{value}</option>
                              ))}
                            </select>
                          </label>
                          <label className='text-xs'>
                            <span className='block text-[hsl(var(--muted-foreground))]'>Tags (services)</span>
                            <div className='mt-1 rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1'>
                              <div className='mb-1 flex flex-wrap gap-1'>
                                {draft.tags.length === 0 && <span className='text-[11px] text-[hsl(var(--muted-foreground))]'>No tags selected</span>}
                                {draft.tags.map((tag) => (
                                  <button
                                    key={tag}
                                    type='button'
                                    className='rounded bg-[hsl(var(--surface-3))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--foreground))]'
                                    onClick={() => patchEditDraft(editKey, { tags: draft.tags.filter((value) => value !== tag) })}
                                  >
                                    {tag} ×
                                  </button>
                                ))}
                              </div>
                              <div className='flex flex-wrap gap-1'>
                                {serviceTagOptions.map((option) => {
                                  const selected = draft.tags.includes(option.value);
                                  return (
                                    <button
                                      key={option.value}
                                      type='button'
                                      className={`rounded px-1.5 py-0.5 text-[11px] ${
                                        selected ? 'bg-emerald-700 text-emerald-100' : 'bg-[hsl(var(--surface-3))] text-[hsl(var(--foreground))]'
                                      }`}
                                      onClick={() => patchEditDraft(editKey, {
                                        tags: selected
                                          ? draft.tags.filter((value) => value !== option.value)
                                          : [...draft.tags, option.value],
                                      })}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </label>
                          <label className='text-xs'>
                            <span className='block text-[hsl(var(--muted-foreground))]'>Sort order</span>
                            <input
                              type='number'
                              min={0}
                              className='mt-1 w-full rounded border border-border bg-[hsl(var(--surface-2))] px-2 py-1 text-sm'
                              value={draft.sort_order}
                                onChange={(e) => patchEditDraft(editKey, { sort_order: Number(e.target.value) })}
                            />
                          </label>
                        </div>
                        {draft.error && <p className='text-xs text-red-400'>{draft.error}</p>}
                        <div className='flex gap-2'>
                          <button
                            type='button'
                            onClick={() => saveEdit(editKey)}
                            disabled={draft.saving}
                            className='btn-accent px-3 py-1 text-xs font-medium disabled:opacity-40'
                          >
                            {draft.saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type='button'
                            onClick={() => setEditingKey(null)}
                            className='rounded border border-border px-3 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-2))]'
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isEditing && editKey && (
                    <div className='flex flex-shrink-0 flex-col gap-1'>
                      <button
                        type='button'
                        onClick={() => startEdit(item)}
                        className='rounded border border-border px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-2))]'
                      >
                        Edit
                      </button>
                      {itemId !== null && kind !== 'video' && (
                        <button
                          type='button'
                          onClick={() => navigate(`/admin/gallery/${itemId}/crop`)}
                          className='rounded border border-[hsl(var(--accent)/0.5)] px-2 py-1 text-xs text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.1)]'
                        >
                          ✂ Crop
                        </button>
                      )}
                      {itemId !== null && kind !== 'video' && item.thumb_url && (
                        <button
                          type='button'
                          onClick={() => setFocalItem({ id: itemId, url: item.thumb_url ?? item.r2_key, fx: item.focal_x ?? 0.5, fy: item.focal_y ?? 0.5 })}
                          className='rounded border border-[hsl(var(--accent)/0.5)] px-2 py-1 text-xs text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/0.1)]'
                        >
                          · Focal
                        </button>
                      )}
                      {itemId !== null && (
                        <button
                          type='button'
                          onClick={() => handleDelete(item)}
                          className='rounded border border-red-700 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40'
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                  {!isEditing && isDriveOnly && (
                    <p className='text-[11px] text-[hsl(var(--muted-foreground))]'>Managed via Drive folder</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <datalist id='gallery-tag-suggestions'>
        {tagStats.map((entry) => (
          <option key={entry.tag} value={entry.tag} />
        ))}
      </datalist>
    <FocalPointModal
        open={focalItem !== null}
        itemId={focalItem?.id ?? null}
        imageUrl={focalItem?.url ?? null}
        initialFocalX={focalItem?.fx ?? 0.5}
        initialFocalY={focalItem?.fy ?? 0.5}
        onClose={() => setFocalItem(null)}
        onSaved={() => { invalidateGallery(); }}
      />
    </section>
  );
}
