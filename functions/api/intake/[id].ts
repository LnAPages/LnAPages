import { z } from 'zod';
import { intakeUpdateSchema } from '../../../shared/schemas/intake';
import { ok, parseJson, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

const idSchema = z.coerce.number().int().positive();

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const id = idSchema.parse(context.params.id);
  const payload = await parseJson(context.request, intakeUpdateSchema);
  await context.env.FNLSTG_DB.prepare(
    `UPDATE intakes
     SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone),
         project_type = COALESCE(?, project_type), message = COALESCE(?, message), status = COALESCE(?, status)
     WHERE id = ?`,
  ).bind(payload.name ?? null, payload.email ?? null, payload.phone ?? null, payload.project_type ?? null, payload.message ?? null, payload.status ?? null, id).run();
  return ok({ id });
};
