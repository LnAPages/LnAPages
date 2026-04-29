import { z } from 'zod';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { HttpError, ok } from '../../lib/http';
import type { Env } from '../../lib/types';

const schema = z.object({ booking_id: z.number().int().positive() });

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const { booking_id } = schema.parse(await request.json());
  const booking = await env.FNLSTG_DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(booking_id).first<{ id: number; customer_name: string; customer_email: string; amount_cents: number; start_time: string }>();
  if (!booking) throw new HttpError(404, 'NOT_FOUND', 'Booking not found');

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('FNL STAGE INVOICE', { x: 50, y: 790, size: 24, font, color: rgb(0.05, 0.1, 0.2) });
  page.drawText(`Booking #${booking.id}`, { x: 50, y: 740, size: 12, font });
  page.drawText(`Customer: ${booking.customer_name}`, { x: 50, y: 720, size: 12, font });
  page.drawText(`Email: ${booking.customer_email}`, { x: 50, y: 700, size: 12, font });
  page.drawText(`Session: ${booking.start_time}`, { x: 50, y: 680, size: 12, font });
  page.drawText(`Amount: $${(booking.amount_cents / 100).toFixed(2)}`, { x: 50, y: 660, size: 12, font });
  const bytes = await pdf.save();

  const number = `INV-${new Date().getUTCFullYear()}-${booking.id}`;
  const key = `invoices/${number}.pdf`;
  await env.FNLSTG_GALLERY.put(key, bytes, { httpMetadata: { contentType: 'application/pdf' } });
  await env.FNLSTG_DB.prepare(
    `INSERT INTO invoices (booking_id, number, r2_key, amount_cents, issued_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
  ).bind(booking.id, number, key, booking.amount_cents).run();

  return ok({ booking_id: booking.id, number, key, url: `${env.R2_PUBLIC_BASE_URL}/${key}` });
};
