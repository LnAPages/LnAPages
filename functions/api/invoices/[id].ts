import { z } from 'zod';
import { HttpError, ok, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

const idSchema = z.coerce.number().int().positive();

export const onRequestGet: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);
  const id = idSchema.parse(context.params.id);
  const row = await context.env.LNAPAGES_DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Invoice not found');
  return ok(row);
};
