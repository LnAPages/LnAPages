import { isShopEnabled } from './lib/shop';
import type { Env } from './lib/types';

export const onRequest: PagesFunction<Env> = async (context) => {
  if (!(await isShopEnabled(context.env))) {
    return new Response('Not Found', { status: 404 });
  }
  return context.next();
};
