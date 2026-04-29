import { z } from 'zod';
import { fail, HttpError, ok, parseJson, requireAdmin } from '../../lib/http';
import type { Env } from '../../lib/types';

const testEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(2000).optional(),
});

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await requireAdmin(context);

  const apiKey = (context.env as unknown as { RESEND_API_KEY?: string }).RESEND_API_KEY;
  const from = (context.env as unknown as { RESEND_FROM_EMAIL?: string }).RESEND_FROM_EMAIL;

  if (!apiKey) {
    return fail(500, 'CONFIG_MISSING', 'RESEND_API_KEY is not set in Cloudflare env vars.');
  }
  if (!from) {
    return fail(500, 'CONFIG_MISSING', 'RESEND_FROM_EMAIL is not set in Cloudflare env vars.');
  }

  const body = await parseJson(context.request, testEmailSchema);
  const subject = body.subject ?? 'FNLSTG Resend test';
  const text =
    body.message ??
    'This is a test email from your FNLSTG admin panel. If you received this, Resend is wired up correctly.';

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [body.to],
      subject,
      text,
    }),
  });

  const responseText = await resendResponse.text();
  let parsed: unknown = responseText;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    /* not JSON, keep as string */
  }

  if (!resendResponse.ok) {
    throw new HttpError(
      resendResponse.status,
      'RESEND_ERROR',
      typeof parsed === 'object' && parsed && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : `Resend returned ${resendResponse.status}`,
    );
  }

  return ok({
    sent: true,
    to: body.to,
    from,
    provider_response: parsed,
  });
};
