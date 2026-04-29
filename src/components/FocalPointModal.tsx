import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

type FocalPointModalProps = {
  open: boolean;
  itemId: number | null;
  imageUrl: string | null;
  initialFocalX?: number;
  initialFocalY?: number;
  onClose: () => void;
  onSaved?: (focal: { focal_x: number; focal_y: number }) => void;
};

export function FocalPointModal({
  open,
  itemId,
  imageUrl,
  initialFocalX = 0.5,
  initialFocalY = 0.5,
  onClose,
  onSaved,
}: FocalPointModalProps) {
  const [fx, setFx] = useState(initialFocalX);
  const [fy, setFy] = useState(initialFocalY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (open) {
      setFx(initialFocalX);
      setFy(initialFocalY);
      setErr(null);
    }
  }, [open, initialFocalX, initialFocalY]);

  if (!open) return null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setFx(Math.max(0, Math.min(1, x)));
    setFy(Math.max(0, Math.min(1, y)));
  };

  const save = async () => {
    if (!itemId) return;
    setSaving(true);
    setErr(null);
    try {
      await api.patch(`/admin/gallery/${itemId}/focal`, { focal_x: fx, focal_y: fy });
      onSaved?.({ focal_x: fx, focal_y: fy });
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to save focal point');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full bg-[hsl(var(--surface-1))] border border-border rounded-lg p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Set focal point</h2>
          <button
            type="button"
            className="text-sm opacity-70 hover:opacity-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <p className="text-xs opacity-70 mb-2">
          Click on the image where you want the crop to focus. Dot shows current focal point.
        </p>
        {imageUrl ? (
          <div
            className="relative w-full bg-black/50 rounded overflow-hidden cursor-crosshair select-none"
            style={{ aspectRatio: '4 / 3' }}
            onClick={handleClick}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt=""
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
            <div
              className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white bg-[hsl(var(--accent))] shadow-[0_0_0_2px_rgba(0,0,0,0.5)] pointer-events-none"
              style={{ left: `${fx * 100}%`, top: `${fy * 100}%` }}
            />
          </div>
        ) : (
          <div className="text-sm opacity-70">No image to preview.</div>
        )}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="opacity-70">
            focal_x: {fx.toFixed(3)} · focal_y: {fy.toFixed(3)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="pill px-3 py-1 text-xs"
              onClick={() => { setFx(0.5); setFy(0.5); }}
              disabled={saving}
            >
              Reset to center
            </button>
            <button
              type="button"
              className="pill px-3 py-1 text-xs bg-[hsl(var(--accent))] text-[hsl(var(--accent-fg))]"
              onClick={save}
              disabled={saving || !itemId}
            >
              {saving ? 'Saving…' : 'Save focal point'}
            </button>
          </div>
        </div>
        {err && <div className="mt-2 text-xs text-red-400">{err}</div>}
      </div>
    </div>
  );
}

export default FocalPointModal;
