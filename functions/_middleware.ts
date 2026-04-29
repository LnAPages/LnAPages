import { HttpError, corsHeaders, fail, getAdminUser, verifyCsrf } from './lib/http';
import type { Env } from './lib/types';

function withCors(response: Response, origin = '*') {
  const headers = corsHeaders(origin);
  response.headers.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(context.request.headers.get('origin') ?? '*') });
  }

  try {
    const pathname = new URL(context.request.url).pathname;
    if (pathname.startsWith('/api/admin/')) {
      const user = await getAdminUser(context);
      if (!user) {
        throw new HttpError(401, 'UNAUTHORIZED', 'Admin authentication required');
      }
      if (CSRF_METHODS.has(context.request.method)) {
        await verifyCsrf(context, user);
      }
    }

    const response = await context.next();
    return withCors(response, context.request.headers.get('origin') ?? '*');
  } catch (error) {
    if (error instanceof HttpError) {
      return withCors(fail(error.status, error.code, error.message), context.request.headers.get('origin') ?? '*');
    }
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return withCors(fail(500, 'INTERNAL_ERROR', message), context.request.headers.get('origin') ?? '*');
  }
};
