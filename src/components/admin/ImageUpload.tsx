import { useRef, useState } from 'react';

type Props = {
    value?: string | null;
    onChange: (url: string | null) => void;
    folder?: string;
    label?: string;
    className?: string;
};

export function ImageUpload({ value, onChange, folder = 'uploads', label = 'Image', className }: Props) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
        setError(null);
        setBusy(true);
        try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', folder);
                const res = await fetch('/api/admin/upload', {
                          method: 'POST',
                          body: fd,
                          credentials: 'include',
                });
                const json = (await res.json()) as
                          | { ok: true; data: { url: string; key: string } }
            | { ok: false; error: { code: string; message: string } };
          if (!('ok' in json) || !json.ok) {
                    const msg = 'ok' in json && !json.ok ? json.error.message : 'Upload failed';
                    throw new Error(msg);
          }
          onChange(json.data.url);
  } catch (e) {
          setError(e instanceof Error ? e.message : 'Upload failed');
} finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
}
}

  return (
        <div className={className}>
                <div className='text-xs font-medium mb-1'>{label}</div>
          {value ? (
                  <div className='flex items-center gap-3'>
                            <img
                                          src={value}
                                          alt=''
                                          className='h-20 w-20 object-cover rounded border border-[hsl(var(--border))]'
                                        />
                            <div className='flex flex-col gap-1'>
                                        <button
                                                        type='button'
                                                        onClick={() => inputRef.current?.click()}
                          disabled={busy}
                                                        className='rounded border px-2 py-1 text-xs hover:bg-[hsl(var(--surface-3))] disabled:opacity-50'
                                                      >
                                          {busy ? 'Uploading…' : 'Replace'}
                                        </button>
                                        <button
                                                        type='button'
                                                        onClick={() => onChange(null)}
                                                        disabled={busy}
                                                        className='rounded border border-red-700 text-red-400 px-2 py-1 text-xs hover:bg-red-900/40 disabled:opacity-50'
                                                      >
                                                      Remove
                                        </button>
                            </div>
                  </div>
                ) : (
                  <button
                              type='button'
                              onClick={() => inputRef.current?.click()}
                              disabled={busy}
                              className='rounded border border-dashed px-3 py-2 text-xs hover:bg-[hsl(var(--surface-3))] disabled:opacity-50'
                            >
                    {busy ? 'Uploading…' : 'Upload image'}
                  </button>
              )}
              <input
                        ref={inputRef}
                        type='file'
                        accept='image/*'
                        className='hidden'
                        onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleFile(f);
                        }}
                      />
          {error && <p className='text-xs text-red-400 mt-1'>{error}</p>}
        </div>
      );
}

export default ImageUpload;
