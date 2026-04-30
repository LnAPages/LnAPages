import { z } from 'zod';
import { HttpError, ok, parseJson, requireAdmin, verifyCsrf } from '../../../../../lib/http';
import { writeAuditLog } from '../../../../../lib/auth';
import type { Env } from '../../../../../lib/types';

const schema = z.object({
  done: z.boolean(),
  notes: z.string().max(2000).optional(),
});

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const user = await requireAdmin(context);
  await verifyCsrf(context, user);

  const taskId = Number(context.params['id']);
  const itemId = Number(context.params['itemId']);
  if (!taskId || !itemId) throw new HttpError(400, 'BAD_REQUEST', 'Invalid id');

  const body = await parseJson(request, schema);

  await env.LNAPAGES_DB
    .prepare(
      `UPDATE task_items SET
         done = ?,
         done_by = ?,
         done_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
         notes = COALESCE(?, notes)
       WHERE id = ? AND task_id = ?`,
    )
    .bind(body.done ? 1 : 0, user.id, body.done ? 1 : 0, body.notes ?? null, itemId, taskId)
    .run();

  await writeAuditLog(env.LNAPAGES_DB, body.done ? 'task_item.done' : 'task_item.undone', {
    userId: user.id,
    resourceType: 'task_item',
    resourceId: String(itemId),
    metadata: { taskId },
    ip: request.headers.get('cf-connecting-ip') ?? undefined,
    ua: request.headers.get('user-agent') ?? undefined,
  });

  return ok({ updated: true });
};
