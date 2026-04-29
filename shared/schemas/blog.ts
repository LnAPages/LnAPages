import { z } from 'zod';

export const blogPostSchema = z.object({
  id: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers and hyphens.'),
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).default(''),
  body: z.string().default(''),
  cover_url: z.string().url().or(z.literal('')).default(''),
  author: z.string().max(120).default(''),
  published: z.boolean().default(false),
  published_at: z.string().nullable().default(null),
  created_at: z.string(),
  updated_at: z.string(),
});

export const blogPostInputSchema = blogPostSchema
  .omit({ id: true, created_at: true, updated_at: true, published_at: true })
  .extend({
    published_at: z.string().nullable().optional(),
  });

export const blogStateSchema = z.object({
  posts: z.array(blogPostSchema),
});

export type BlogPost = z.infer<typeof blogPostSchema>;
export type BlogPostInput = z.infer<typeof blogPostInputSchema>;
