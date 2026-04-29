import { z } from 'zod';

export const menuLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  url: z.string().min(1),
  new_tab: z.boolean().default(false),
  sort_order: z.number().int().nonnegative().default(0),
});

export const menuSchema = z.object({
  links: z.array(menuLinkSchema),
});

export type MenuLink = z.infer<typeof menuLinkSchema>;
