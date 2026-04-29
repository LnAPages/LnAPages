import { z } from 'zod';
import { fail, ok, parseJson, requireAdmin } from '../../../lib/http';
import type { Env, PresignableR2Bucket } from '../../../lib/types';

const schema = z.object({
  filename: z.string().min(1),
  contentType: z.string().optional(),
});

function presignUrlToString(presigned: string | URL | { url: string | URL }): string {
  if (typeof presigned === 'string') return presigned;
  if (presigned instanceof URL) return presigned.toString();
  if (typeof presigned.url === 'string') return presigned.url;
  return presigned.url.toString();
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, schema);
  const bucket = context.env.R2_SHOP as PresignableR2Bucket | undefined;
  if (!bucket || typeof bucket.createPresignedUrl !== 'function') {
    return fail(500, 'PRESIGN_UNAVAILABLE', 'R2_SHOP presign is not available');
  }

  const key = `products/${crypto.randomUUID()}-${payload.filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
  const presigned = await bucket.createPresignedUrl({ method: 'PUT', key, expiresIn: 900 });
  return ok({
    key,
    url: presignUrlToString(presigned),
    headers: { 'Content-Type': payload.contentType || 'application/octet-stream' },
  });
};
