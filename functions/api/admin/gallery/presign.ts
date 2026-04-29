import { z } from 'zod';
import { inferGalleryKind } from '../../../../shared/galleryUtils';
import { fail, ok, parseJson, requireAdmin } from '../../../lib/http';
import type { Env, PresignableR2Bucket } from '../../../lib/types';

const presignSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().optional(),
  kind: z.enum(['image', 'video']).optional(),
});

function presignUrlToString(presigned: string | URL | { url: string | URL }): string {
  if (typeof presigned === 'string') return presigned;
  if (presigned instanceof URL) return presigned.toString();
  if (typeof presigned.url === 'string') return presigned.url;
  return presigned.url.toString();
}

function extFromName(name: string, fallback: string): string {
  const idx = name.lastIndexOf('.');
  if (idx === -1 || idx === name.length - 1) return fallback;
  return name.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || fallback;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const payload = await parseJson(context.request, presignSchema);

  const kind = payload.kind ?? inferGalleryKind(payload.contentType, payload.filename);
  const fallbackExt = kind === 'video' ? 'mp4' : 'jpg';
  const key = `gallery/${crypto.randomUUID()}.${extFromName(payload.filename, fallbackExt)}`;
  const contentType = (payload.contentType ?? '').trim() || (kind === 'video' ? 'video/mp4' : 'image/jpeg');

  const bucket = context.env.FNLSTG_GALLERY as PresignableR2Bucket;
  if (typeof bucket.createPresignedUrl !== 'function') {
    return fail(500, 'PRESIGN_UNAVAILABLE', 'R2 presign is not available in this runtime');
  }

  const presigned = await bucket.createPresignedUrl({ method: 'PUT', key, expiresIn: 900 });
  const url = presignUrlToString(presigned);

  if (!url) {
    return fail(500, 'PRESIGN_FAILED', 'Failed to create presigned upload URL');
  }

  return ok({
    url,
    key,
    headers: {
      'Content-Type': contentType,
    },
  });
};
