import { fail, ok, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

function extFor(type: string): string {
    if (type === 'image/jpeg') return 'jpg';
    if (type === 'image/png') return 'png';
    if (type === 'image/webp') return 'webp';
    if (type === 'image/gif') return 'gif';
    if (type === 'image/avif') return 'avif';
    return 'bin';
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    await requireAdmin(context);
    const bucket = context.env.LNAPAGES_GALLERY;
    const publicBase = context.env.R2_PUBLIC_BASE_URL;
    if (!bucket) return fail(500, 'R2_UNAVAILABLE', 'LNAPAGES_GALLERY bucket binding missing');
    if (!publicBase) return fail(500, 'R2_UNAVAILABLE', 'R2_PUBLIC_BASE_URL not configured');

    const contentType = context.request.headers.get('content-type') || '';
    let bytes: ArrayBuffer;
    let type: string;
    let originalName = 'upload';
    let folder = 'uploads';

    if (contentType.startsWith('multipart/form-data')) {
          const form = await context.request.formData();
          const file = form.get('file');
          const f = form.get('folder');
          if (typeof f === 'string' && /^[a-z0-9_-]+$/i.test(f)) folder = f;
          if (!file || typeof file === 'string') return fail(400, 'NO_FILE', 'No file provided');
          type = file.type || 'application/octet-stream';
          originalName = file.name || originalName;
          if (file.size > MAX_BYTES) return fail(413, 'TOO_LARGE', 'File exceeds 10MB');
          bytes = await file.arrayBuffer();
    } else {
          type = contentType || 'application/octet-stream';
          const headerName = context.request.headers.get('x-filename');
          if (headerName) originalName = headerName;
          const headerFolder = context.request.headers.get('x-folder');
          if (headerFolder && /^[a-z0-9_-]+$/i.test(headerFolder)) folder = headerFolder;
          bytes = await context.request.arrayBuffer();
          if (bytes.byteLength > MAX_BYTES) return fail(413, 'TOO_LARGE', 'File exceeds 10MB');
    }

    if (!ALLOWED.has(type)) return fail(415, 'BAD_TYPE', `Unsupported content type: ${type}`);

    const safeName = originalName.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 60);
    const key = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}.${extFor(type)}`;

    await bucket.put(key, bytes, { httpMetadata: { contentType: type } });

    const base = publicBase.replace(/\/$/, '');
    const url = `${base}/${key}`;
    return ok({ key, url, contentType: type, size: bytes.byteLength });
};
