import { fail, ok, requireAdmin } from '../../../lib/http';
import type { Env } from '../../../lib/types';

const MAX_KV_UPLOAD_BYTES = 200 * 1024;

type UploadFileLike = {
  name?: string;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function extFromFileName(name: string, fallback = 'bin'): string {
  const idx = name.lastIndexOf('.');
  if (idx < 0 || idx >= name.length - 1) return fallback;
  return name.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || fallback;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function normalizeMimeType(type: string | null): string {
  const trimmed = (type ?? '').trim().toLowerCase();
  return trimmed || 'application/octet-stream';
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);

  const formData = await context.request.formData();
  const fileCandidate = formData.get('file') as unknown;
  if (!fileCandidate || typeof fileCandidate !== 'object' || !('arrayBuffer' in fileCandidate)) {
    return fail(400, 'VALIDATION_ERROR', 'Expected multipart file field named "file"');
  }

  const filePart = fileCandidate as UploadFileLike;

  const fileName = typeof filePart.name === 'string' ? filePart.name : 'upload.bin';
  const ext = extFromFileName(fileName, 'bin');
  const key = `brand/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const contentType = normalizeMimeType(typeof filePart.type === 'string' ? filePart.type : null);
  const bytes = new Uint8Array(await filePart.arrayBuffer());

  const mediaBucket = context.env.FNLSTG_GALLERY;
  if (mediaBucket && typeof mediaBucket.put === 'function') {
    await mediaBucket.put(key, bytes, { httpMetadata: { contentType } });

    const base = (context.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
    const url = base ? `${base}/${key}` : key;
    return ok({
      key,
      url,
      storage: 'r2',
      content_type: contentType,
      size: bytes.length,
    });
  }

  if (bytes.length > MAX_KV_UPLOAD_BYTES) {
    return fail(400, 'UPLOAD_TOO_LARGE', 'File exceeds 200KB fallback size limit without FNLSTG_MEDIA binding');
  }

  const dataUrl = `data:${contentType};base64,${toBase64(bytes)}`;
  const kvKey = `brand_media:${Date.now()}-${crypto.randomUUID()}.${ext}`;
  await context.env.FNLSTG_CONFIG.put(
    kvKey,
    JSON.stringify({
      key,
      data_url: dataUrl,
      content_type: contentType,
      size: bytes.length,
      uploaded_at: new Date().toISOString(),
    }),
  );

  return ok({
    key: kvKey,
    url: dataUrl,
    storage: 'kv_data_url',
    content_type: contentType,
    size: bytes.length,
  });
};
