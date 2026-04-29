import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { GalleryItem, GalleryCrop } from '@/types';

const ASPECT_PRESETS = [
  { label: 'Free', value: 'free', ratio: null },
  { label: '1:1', value: '1:1', ratio: 1 },
  { label: '4:5', value: '4:5', ratio: 4 / 5 },
  { label: '9:16', value: '9:16', ratio: 9 / 16 },
  { label: '16:9', value: '16:9', ratio: 16 / 9 },
  { label: '3:2', value: '3:2', ratio: 3 / 2 },
  { label: '2:3', value: '2:3', ratio: 2 / 3 },
] as const;

const CONTEXT_KEYS = ['default', 'hero', 'grid', 'service_card', 'product_card', 'blog', 'og'] as const;
type ContextKey = (typeof CONTEXT_KEYS)[number];

const CONTEXT_LABELS: Record<ContextKey, string> = {
  default: 'Default',
  hero: 'Hero',
  grid: 'Grid',
  service_card: 'Service Card',
  product_card: 'Product Card',
  blog: 'Blog',
  og: 'OG Image',
};

type CropState = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  flip_h: boolean;
  flip_v: boolean;
  aspect: string;
  focal_x: number;
  focal_y: number;
};

function getDefaultCrop(aspectRatio: number | null, imageAspect: number): CropState {
  let x = 0, y = 0, w = 1, h = 1;
  if (aspectRatio !== null) {
    if (aspectRatio > imageAspect) {
      h = imageAspect / aspectRatio;
      y = (1 - h) / 2;
    } else {
      w = (aspectRatio * 1) / imageAspect;
      x = (1 - w) / 2;
    }
  }
  return { x, y, w, h, rotation: 0, flip_h: false, flip_v: false, aspect: 'free', focal_x: 0.5, focal_y: 0.5 };
}

// Canvas drawing helpers
function drawCropOverlay(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  crop: CropState,
  zoom: number,
  panX: number,
  panY: number,
  showFocal: boolean,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const dw = img.naturalWidth * zoom;
  const dh = img.naturalHeight * zoom;
  const ox = (canvas.width - dw) / 2 + panX;
  const oy = (canvas.height - dh) / 2 + panY;

  ctx.save();
  ctx.translate(canvas.width / 2 + panX, canvas.height / 2 + panY);
  ctx.rotate((crop.rotation * Math.PI) / 180);
  if (crop.flip_h) ctx.scale(-1, 1);
  if (crop.flip_v) ctx.scale(1, -1);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  // Dim outside crop
  const cx = ox + crop.x * dw;
  const cy = oy + crop.y * dh;
  const cw = crop.w * dw;
  const ch = crop.h * dh;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(cx, cy, cw, ch);

  // Crop border
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx, cy, cw, ch);

  // Rule of thirds
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + (cw * i) / 3, cy);
    ctx.lineTo(cx + (cw * i) / 3, cy + ch);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy + (ch * i) / 3);
    ctx.lineTo(cx + cw, cy + (ch * i) / 3);
    ctx.stroke();
  }

  // Focal point bullseye
  if (showFocal) {
    const fx = ox + crop.focal_x * dw;
    const fy = oy + crop.focal_y * dh;
    ctx.strokeStyle = '#FF4466';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx, fy, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx - 14, fy);
    ctx.lineTo(fx + 14, fy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx, fy - 14);
    ctx.lineTo(fx, fy + 14);
    ctx.stroke();
  }
  ctx.restore();
}

export default function GalleryCropEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [activeContext, setActiveContext] = useState<ContextKey>('default');
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [dragging, setDragging] = useState<'crop' | 'focal' | 'pan' | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [activeAspect, setActiveAspect] = useState<string>('free');
  const [showFocal, setShowFocal] = useState(true);
  const [crops, setCrops] = useState<Record<ContextKey, CropState>>({} as Record<ContextKey, CropState>);
  const [message, setMessage] = useState<string | null>(null);

  const numId = parseInt(id ?? '', 10);

  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ['admin', 'gallery-item', numId],
    queryFn: () => api.get<GalleryItem>(`/admin/gallery/${numId}`),
    enabled: !!numId,
  });

  const { data: existingCrops } = useQuery({
    queryKey: ['admin', 'gallery-crops', numId],
    queryFn: () => api.get<GalleryCrop[]>(`/admin/gallery/${numId}/crop`),
    enabled: !!numId,
  });

  // Initialise crop states from DB
  useEffect(() => {
    if (!existingCrops) return;
    const nextCrops: Partial<Record<ContextKey, CropState>> = {};
    for (const c of existingCrops) {
      const k = c.context_key as ContextKey;
      nextCrops[k] = {
        x: c.crop_x, y: c.crop_y, w: c.crop_width, h: c.crop_height,
        rotation: c.rotation, flip_h: c.flip_h as unknown as boolean, flip_v: c.flip_v as unknown as boolean,
        aspect: c.aspect,
        focal_x: item?.focal_x ?? 0.5,
        focal_y: item?.focal_y ?? 0.5,
      };
    }
    // Fill missing contexts with full-image defaults
    for (const k of CONTEXT_KEYS) {
      if (!nextCrops[k]) {
        nextCrops[k] = { x: 0, y: 0, w: 1, h: 1, rotation: 0, flip_h: false, flip_v: false, aspect: 'free', focal_x: item?.focal_x ?? 0.5, focal_y: item?.focal_y ?? 0.5 };
      }
    }
    setCrops(nextCrops as Record<ContextKey, CropState>);
  }, [existingCrops, item]);

  const saveMutation = useMutation({
    mutationFn: async ({ contextKey, crop }: { contextKey: ContextKey; crop: CropState }) => {
      const saved = await api.put<GalleryCrop>(`/admin/gallery/${numId}/crop`, {
        context_key: contextKey,
        aspect: crop.aspect,
        crop_x: crop.x, crop_y: crop.y, crop_width: crop.w, crop_height: crop.h,
        rotation: crop.rotation, flip_h: crop.flip_h, flip_v: crop.flip_v,
      });
      // Also save focal point
      await api.patch(`/admin/gallery/${numId}/crop`, { focal_x: crop.focal_x, focal_y: crop.focal_y });
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gallery-crops', numId] });
      qc.invalidateQueries({ queryKey: ['admin', 'gallery'] });
      setMessage('Crop saved ✓');
      setTimeout(() => setMessage(null), 2000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (contextKey: ContextKey) =>
      api.delete(`/admin/gallery/${numId}/crop?context=${contextKey}`),
    onSuccess: (_data, contextKey) => {
      setCrops((prev) => ({
        ...prev,
        [contextKey]: { x: 0, y: 0, w: 1, h: 1, rotation: 0, flip_h: false, flip_v: false, aspect: 'free', focal_x: 0.5, focal_y: 0.5 },
      }));
      qc.invalidateQueries({ queryKey: ['admin', 'gallery-crops', numId] });
      setMessage('Crop reset ✓');
      setTimeout(() => setMessage(null), 2000);
    },
  });

  const currentCrop = crops[activeContext] ?? { x: 0, y: 0, w: 1, h: 1, rotation: 0, flip_h: false, flip_v: false, aspect: 'free', focal_x: 0.5, focal_y: 0.5 };
  const patchCrop = useCallback((patch: Partial<CropState>) => {
    setCrops((prev) => ({
      ...prev,
      [activeContext]: { ...(prev[activeContext] ?? currentCrop), ...patch },
    }));
  }, [activeContext, currentCrop]);

  // Load image
  useEffect(() => {
    if (!item?.r2_key) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = item.r2_key;
  }, [item?.r2_key]);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    drawCropOverlay(canvas, img, currentCrop, zoom, panX, panY, showFocal);
  }, [currentCrop, zoom, panX, panY, imgLoaded, showFocal]);

  // Canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Canvas mouse events
  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const canvasToCropCoords = useCallback((cx: number, cy: number) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return { x: 0, y: 0 };
    const dw = img.naturalWidth * zoom;
    const dh = img.naturalHeight * zoom;
    const ox = (canvas.width - dw) / 2 + panX;
    const oy = (canvas.height - dh) / 2 + panY;
    return { x: Math.max(0, Math.min(1, (cx - ox) / dw)), y: Math.max(0, Math.min(1, (cy - oy) / dh)) };
  }, [zoom, panX, panY]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    if (e.button === 1 || e.altKey) {
      setDragging('pan');
    } else if (e.shiftKey) {
      // Focal point placement
      const coords = canvasToCropCoords(pt.x, pt.y);
      patchCrop({ focal_x: coords.x, focal_y: coords.y });
      setDragging('focal');
    } else {
      setDragging('crop');
    }
    setDragStart(pt);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging || !dragStart) return;
    const pt = getCanvasPoint(e);
    const dx = pt.x - dragStart.x;
    const dy = pt.y - dragStart.y;
    if (dragging === 'pan') {
      setPanX((prev) => prev + dx);
      setPanY((prev) => prev + dy);
      setDragStart(pt);
    } else if (dragging === 'focal') {
      const coords = canvasToCropCoords(pt.x, pt.y);
      patchCrop({ focal_x: coords.x, focal_y: coords.y });
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setDragStart(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.1, Math.min(8, z * delta)));
  };

  // Keyboard nav
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(8, z * 1.1));
    if (e.key === '-') setZoom((z) => Math.max(0.1, z * 0.9));
    if (e.key === 'r' || e.key === 'R') patchCrop({ rotation: (currentCrop.rotation + 90) % 360 });
    if (e.key === 'ArrowLeft') patchCrop({ x: Math.max(0, currentCrop.x - 0.01) });
    if (e.key === 'ArrowRight') patchCrop({ x: Math.min(1 - currentCrop.w, currentCrop.x + 0.01) });
    if (e.key === 'ArrowUp') patchCrop({ y: Math.max(0, currentCrop.y - 0.01) });
    if (e.key === 'ArrowDown') patchCrop({ y: Math.min(1 - currentCrop.h, currentCrop.y + 0.01) });
  }, [patchCrop, currentCrop]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const applyAspectPreset = (value: string) => {
    setActiveAspect(value);
    const preset = ASPECT_PRESETS.find((p) => p.value === value);
    if (!preset?.ratio || !imgRef.current) {
      patchCrop({ aspect: value });
      return;
    }
    const imageAspect = imgRef.current.naturalWidth / imgRef.current.naturalHeight;
    const defaults = getDefaultCrop(preset.ratio, imageAspect);
    patchCrop({ x: defaults.x, y: defaults.y, w: defaults.w, h: defaults.h, aspect: value });
  };

  if (itemLoading) return <div className='p-6'><p>Loading…</p></div>;
  if (!item) return <div className='p-6'><p>Gallery item not found.</p></div>;

  return (
    <div className='fixed inset-0 z-50 flex flex-col bg-[hsl(var(--background))]' role='dialog' aria-label='Crop editor'>
      {/* Header */}
      <div className='flex items-center justify-between border-b border-border px-4 py-3'>
        <div className='flex items-center gap-3'>
          <button
            type='button'
            className='btn-ghost px-3 py-1.5 text-sm'
            onClick={() => navigate('/admin/gallery')}
            aria-label='Back to gallery'
          >
            ← back
          </button>
          <h1 className='font-display text-lg font-semibold truncate max-w-xs'>{item.title || item.r2_key}</h1>
        </div>
        <div className='flex gap-2'>
          <button
            type='button'
            className='btn-accent px-4 py-1.5 text-sm'
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({ contextKey: activeContext, crop: currentCrop })}
          >
            {saveMutation.isPending ? 'saving…' : 'save crop'}
          </button>
        </div>
      </div>

      {/* Context tabs */}
      <nav className='flex gap-1 overflow-x-auto border-b border-border px-4 py-2' aria-label='Crop context'>
        {CONTEXT_KEYS.map((k) => (
          <button
            key={k}
            type='button'
            className={`shrink-0 rounded px-3 py-1 text-xs font-medium transition-colors ${
              activeContext === k
                ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-2))]'
            }`}
            onClick={() => setActiveContext(k)}
          >
            {CONTEXT_LABELS[k]}
          </button>
        ))}
      </nav>

      {/* Main area */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Canvas */}
        <div className='relative flex-1 overflow-hidden bg-[hsl(var(--surface))]'>
          <canvas
            ref={canvasRef}
            className='h-full w-full cursor-crosshair'
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            aria-label='Crop canvas — use arrow keys to move crop, +/- to zoom, R to rotate, Shift+click to set focal point'
            tabIndex={0}
          />
          {message && (
            <div className='absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-[hsl(var(--surface-2))] px-3 py-1.5 text-sm shadow'>
              {message}
            </div>
          )}
          <div className='absolute bottom-4 right-4 space-y-1 text-[11px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--surface)/0.8)] px-2 py-1 rounded'>
            <p>Shift+click → focal point</p>
            <p>Alt+drag or middle-drag → pan</p>
            <p>Scroll → zoom · R → rotate</p>
          </div>
        </div>

        {/* Sidebar controls */}
        <div className='w-64 shrink-0 overflow-y-auto border-l border-border p-4 space-y-5'>
          {/* Aspect presets */}
          <div className='space-y-2'>
            <p className='eyebrow'>aspect ratio</p>
            <div className='grid grid-cols-2 gap-1.5'>
              {ASPECT_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type='button'
                  className={`rounded px-2 py-1.5 text-xs transition-colors ${
                    activeAspect === p.value
                      ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                      : 'border border-border hover:bg-[hsl(var(--surface-2))]'
                  }`}
                  onClick={() => applyAspectPreset(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Zoom */}
          <div className='space-y-2'>
            <p className='eyebrow'>zoom · {Math.round(zoom * 100)}%</p>
            <div className='flex items-center gap-2'>
              <button type='button' className='rounded border border-border px-2 py-1 text-xs' onClick={() => setZoom((z) => Math.max(0.1, z * 0.8))} aria-label='Zoom out'>−</button>
              <input
                type='range' min={10} max={800} step={5}
                value={Math.round(zoom * 100)}
                onChange={(e) => setZoom(Number(e.target.value) / 100)}
                className='flex-1'
                aria-label='Zoom level'
              />
              <button type='button' className='rounded border border-border px-2 py-1 text-xs' onClick={() => setZoom((z) => Math.min(8, z * 1.2))} aria-label='Zoom in'>+</button>
            </div>
            <button type='button' className='w-full rounded border border-border px-2 py-1 text-xs' onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}>reset view</button>
          </div>

          {/* Rotation */}
          <div className='space-y-2'>
            <p className='eyebrow'>rotation · {currentCrop.rotation}°</p>
            <div className='flex gap-1.5 flex-wrap'>
              {[0, 90, 180, 270].map((r) => (
                <button key={r} type='button' className={`rounded px-2 py-1 text-xs border border-border ${currentCrop.rotation === r ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]' : ''}`} onClick={() => patchCrop({ rotation: r })}>{r}°</button>
              ))}
            </div>
          </div>

          {/* Flip */}
          <div className='space-y-2'>
            <p className='eyebrow'>flip</p>
            <div className='flex gap-2'>
              <button
                type='button'
                className={`flex-1 rounded px-2 py-1.5 text-xs border border-border ${currentCrop.flip_h ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]' : ''}`}
                onClick={() => patchCrop({ flip_h: !currentCrop.flip_h })}
              >
                ↔ horizontal
              </button>
              <button
                type='button'
                className={`flex-1 rounded px-2 py-1.5 text-xs border border-border ${currentCrop.flip_v ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]' : ''}`}
                onClick={() => patchCrop({ flip_v: !currentCrop.flip_v })}
              >
                ↕ vertical
              </button>
            </div>
          </div>

          {/* Focal point */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <p className='eyebrow'>focal point</p>
              <label className='flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]'>
                <input type='checkbox' checked={showFocal} onChange={(e) => setShowFocal(e.target.checked)} />
                show
              </label>
            </div>
            <p className='text-xs text-[hsl(var(--muted-foreground))]'>
              x: {currentCrop.focal_x.toFixed(2)} · y: {currentCrop.focal_y.toFixed(2)}
            </p>
            <p className='text-[11px] text-[hsl(var(--muted-foreground))]'>Shift+click on canvas to reposition</p>
            <button
              type='button'
              className='w-full rounded border border-border px-2 py-1 text-xs'
              onClick={() => patchCrop({ focal_x: currentCrop.x + currentCrop.w / 2, focal_y: currentCrop.y + currentCrop.h / 2 })}
            >
              center in crop
            </button>
          </div>

          {/* Reset */}
          <div className='space-y-2 pt-2 border-t border-border'>
            <button
              type='button'
              className='w-full rounded border border-border px-2 py-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-2))]'
              onClick={() => {
                patchCrop({ x: 0, y: 0, w: 1, h: 1, rotation: 0, flip_h: false, flip_v: false });
                setActiveAspect('free');
              }}
            >
              reset to full image
            </button>
            <button
              type='button'
              className='w-full rounded border border-red-700 px-2 py-1.5 text-xs text-red-300 hover:bg-red-900/20'
              onClick={() => deleteMutation.mutate(activeContext)}
              disabled={deleteMutation.isPending}
            >
              delete context crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
