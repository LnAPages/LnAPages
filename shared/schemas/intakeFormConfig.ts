import { z } from 'zod';

/**
 * Intake form (public /quote page) configuration.
 *
 * Stored as a single JSON blob in the LNAPAGES_CONFIG KV namespace under the
 * key 'intake-form-config'. Edited from /admin/intakes -> Form settings.
 *
 * The shape of submitted intakes is still governed by shared/schemas/intake.ts;
 * this config only controls labels, copy, dropdown options, and which optional
 * fields are visible on the public form.
 */

export const intakeFormConfigSchema = z.object({
  heading: z.string().min(1).max(80).default('Project inquiry'),
  subheading: z
    .string()
    .max(240)
    .default("Tell us about what you're working on. We typically reply within one business day."),
  submitLabel: z.string().min(1).max(40).default('Send inquiry'),
  consentText: z
    .string()
    .max(240)
    .default('By submitting you agree to be contacted about this project.'),
  successHeading: z.string().min(1).max(80).default('Inquiry sent'),
  successMessage: z
    .string()
    .max(280)
    .default("We'll be in touch within one business day."),
  projectTypes: z
    .array(z.string().min(1).max(60))
    .min(1)
    .max(20)
    .default([
      'Music video',
      'Live event',
      'Brand / commercial',
      'Photography',
      'Editorial / fashion',
      'Documentary',
      'Other',
    ]),
  budgetRanges: z
    .array(z.string().min(1).max(60))
    .min(1)
    .max(20)
    .default([
      'Under $5k',
      '$5k - $15k',
      '$15k - $50k',
      '$50k - $100k',
      '$100k+',
      'Not sure yet',
    ]),
  showPhone: z.boolean().default(true),
  showBudget: z.boolean().default(true),
  showTimeline: z.boolean().default(false),
});

export type IntakeFormConfig = z.infer<typeof intakeFormConfigSchema>;

export const defaultIntakeFormConfig: IntakeFormConfig = intakeFormConfigSchema.parse({});
