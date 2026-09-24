import { z } from 'zod';

export const loginSchema = z.object({
  tenantSlug: z.string().min(1),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9._-]+$/i),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const dailyEggProductionSchema = z.object({
  flockLotId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  extra: z.number().int().min(0).default(0),
  large: z.number().int().min(0).default(0),
  medium: z.number().int().min(0).default(0),
  small: z.number().int().min(0).default(0),
  cracked: z.number().int().min(0).default(0),
  dirty: z.number().int().min(0).default(0),
  deformed: z.number().int().min(0).default(0),
  discard: z.number().int().min(0).default(0),
  avgEggWeightG: z.number().positive().optional(),
  notes: z.string().optional(),
});

export type DailyEggProductionInput = z.infer<typeof dailyEggProductionSchema>;

export const syncOperationSchema = z.object({
  operationId: z.string().uuid(),
  type: z.enum(['dailyEggProduction', 'dailyMortality', 'dailyFeedConsumption']),
  payload: z.record(z.unknown()),
  clientUpdatedAt: z.string().datetime(),
});

export type SyncOperationInput = z.infer<typeof syncOperationSchema>;
