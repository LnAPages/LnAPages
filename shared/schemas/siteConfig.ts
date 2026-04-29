import { z } from 'zod';

export const siteConfigSchema = z.object({
  themeColor: z.string().default('#0f172a'),
  logoUrl: z.string().default(''),
  businessHours: z.string().default('Mon-Sat 09:00-19:00'),
  contactEmail: z.email().default('hello@fnlstage.com'),
  contactPhone: z.string().default('+10000000000'),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
