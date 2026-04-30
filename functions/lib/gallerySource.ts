import { gallerySourceSchema, type GallerySourceConfig } from '../../shared/schemas/gallerySource';
import { normalizeGalleryTags } from '../../shared/galleryUtils';
import type { Env } from './types';

export const GALLERY_SOURCE_KV_KEY = 'gallery_source';
export const GALLERY_DRIVE_OVERRIDES_KV_KEY = 'gallery_drive_overrides';
export const GALLERY_SELECTION_OVERRIDES_KV_KEY = 'gallery_selection_overrides';

const DRIVE_ID_RE = /^[a-zA-Z0-9_-]{10,}$/;

type DriveApiFile = {
  id: string;
  name?: string;
  mimeType?: string;
};

export type DriveGalleryItem = {
  driveId: string;
  title: string;
  url: string;
  thumbUrl: string;
};

export type DriveGalleryOverride = {
  selected?: boolean;
  title?: string;
  alt?: string;
  category?: string;
  tags?: string[];
  sort_order?: number;
};

export function resolveDriveCategoryAndTags(inputCategory?: string, inputTags?: string[]) {
  const category = inputCategory?.trim() || undefined;
  const tags = normalizeGalleryTags(inputTags, category);
  return {
    category: category || tags[0] || 'general',
    tags,
  };
}

function hasDriveGalleryOverride(override: DriveGalleryOverride): boolean {
  return Boolean(
    override.selected !== undefined
    || override.title
    || override.alt
    || override.category
    || (override.tags && override.tags.length > 0)
    || override.sort_order !== undefined,
  );
}

function driveImageUrl(fileId: string, size: 'w1600' | 'w400') {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=${size}`;
}

export function extractDriveFolderId(value?: string): string | undefined {
  const input = (value ?? '').trim();
  if (!input) return undefined;
  if (DRIVE_ID_RE.test(input)) return input;

  try {
    const url = new URL(input);
    const idFromQuery = url.searchParams.get('id');
    if (idFromQuery && DRIVE_ID_RE.test(idFromQuery)) return idFromQuery;

    const folderMatch = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
    if (folderMatch?.[1]) return folderMatch[1];

    const genericMatch = url.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    if (genericMatch?.[1]) return genericMatch[1];
  } catch {
    const folderMatch = input.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
    if (folderMatch?.[1]) return folderMatch[1];
  }

  return undefined;
}

function normalizeGallerySource(raw: unknown): GallerySourceConfig {
  const parsed = gallerySourceSchema.safeParse(raw);
  if (!parsed.success) return gallerySourceSchema.parse({});

  const driveFolderUrl = parsed.data.driveFolderUrl?.trim() || undefined;
  const driveFolderId = parsed.data.driveFolderId?.trim() || extractDriveFolderId(driveFolderUrl);
  return {
    ...parsed.data,
    driveFolderUrl,
    driveFolderId,
  };
}

export async function getGallerySourceConfig(env: Env): Promise<GallerySourceConfig> {
  const raw = await env.LNAPAGES_CONFIG.get(GALLERY_SOURCE_KV_KEY, 'json');
  return normalizeGallerySource(raw);
}

export async function putGallerySourceConfig(env: Env, config: GallerySourceConfig): Promise<void> {
  const normalized = normalizeGallerySource(config);
  await env.LNAPAGES_CONFIG.put(GALLERY_SOURCE_KV_KEY, JSON.stringify(normalized));
}

async function listDriveFilesViaApi(apiKey: string, folderId: string): Promise<DriveApiFile[]> {
  const files: DriveApiFile[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType)');
    url.searchParams.set('orderBy', 'name_natural');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Google Drive API request failed (${response.status})`);
    }
    const payload = (await response.json()) as { nextPageToken?: string; files?: DriveApiFile[] };
    files.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return files.filter((file) => DRIVE_ID_RE.test(file.id) && (file.mimeType ?? '').startsWith('image/'));
}

async function listDriveFilesViaEmbeddedFolder(folderId: string): Promise<DriveApiFile[]> {
  const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}&sz=w1600`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Drive embedded folder request failed (${response.status})`);
  }

  const html = await response.text();
  const ids = new Set<string>();
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/g,
    /https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]{10,})/g,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const id = match[1];
      if (DRIVE_ID_RE.test(id)) ids.add(id);
    }
  }

  return Array.from(ids)
    .filter((id) => id !== folderId)
    .map((id) => ({ id }));
}

export async function fetchDriveGalleryItems(env: Env, folderId: string): Promise<DriveGalleryItem[]> {
  const apiKey = env.GOOGLE_DRIVE_API_KEY?.trim();

  let files: DriveApiFile[] = [];
  if (apiKey) {
    try {
      files = await listDriveFilesViaApi(apiKey, folderId);
    } catch {
      files = [];
    }
  }

  if (files.length === 0) {
    files = await listDriveFilesViaEmbeddedFolder(folderId);
  }

  return files.map((file, index) => ({
    driveId: file.id,
    title: (file.name ?? '').trim() || `Drive image ${index + 1}`,
    url: driveImageUrl(file.id, 'w1600'),
    thumbUrl: driveImageUrl(file.id, 'w400'),
  }));
}

function normalizeDriveGalleryOverride(raw: unknown): DriveGalleryOverride | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const tags = Array.isArray(value.tags)
    ? value.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : undefined;
  const sort_order =
    typeof value.sort_order === 'number' && Number.isInteger(value.sort_order) && value.sort_order >= 0
      ? value.sort_order
      : undefined;
  const normalized: DriveGalleryOverride = {
    selected: typeof value.selected === 'boolean' ? value.selected : undefined,
    title: typeof value.title === 'string' ? value.title.trim() : undefined,
    alt:
      typeof value.alt === 'string'
        ? value.alt.trim()
        : (typeof value.alt_text === 'string' ? value.alt_text.trim() : undefined),
    category: typeof value.category === 'string' ? value.category.trim() : undefined,
    tags,
    sort_order,
  };
  if (!hasDriveGalleryOverride(normalized)) {
    return null;
  }
  return normalized;
}

export async function getDriveGalleryOverrides(env: Env): Promise<Record<string, DriveGalleryOverride>> {
  const raw = await env.LNAPAGES_CONFIG.get(GALLERY_DRIVE_OVERRIDES_KV_KEY, 'json');
  if (!raw || typeof raw !== 'object') return {};
  const parsed = raw as Record<string, unknown>;
  const entries = Object.entries(parsed)
    .filter(([driveId]) => DRIVE_ID_RE.test(driveId))
    .map(([driveId, value]) => [driveId, normalizeDriveGalleryOverride(value)] as const)
    .filter((entry): entry is readonly [string, DriveGalleryOverride] => Boolean(entry[1]));
  return Object.fromEntries(entries);
}

export async function putDriveGalleryOverride(env: Env, driveId: string, override: DriveGalleryOverride): Promise<DriveGalleryOverride> {
  if (!DRIVE_ID_RE.test(driveId)) {
    throw new Error('Invalid drive id');
  }
  const normalized = normalizeDriveGalleryOverride(override);
  const current = await getDriveGalleryOverrides(env);
  if (normalized) current[driveId] = normalized;
  else delete current[driveId];
  await env.LNAPAGES_CONFIG.put(GALLERY_DRIVE_OVERRIDES_KV_KEY, JSON.stringify(current));
  return normalized ?? {};
}

export async function getGallerySelectionOverrides(env: Env): Promise<Record<string, boolean>> {
  const raw = await env.LNAPAGES_CONFIG.get(GALLERY_SELECTION_OVERRIDES_KV_KEY, 'json');
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([key, value]) => Boolean(key) && typeof value === 'boolean') as Array<[string, boolean]>;
  return Object.fromEntries(entries);
}

export async function putGallerySelectionOverride(env: Env, key: string, selected: boolean): Promise<void> {
  const id = key.trim();
  if (!id) throw new Error('Invalid gallery selection key');
  const current = await getGallerySelectionOverrides(env);
  current[id] = selected;
  await env.LNAPAGES_CONFIG.put(GALLERY_SELECTION_OVERRIDES_KV_KEY, JSON.stringify(current));
}
