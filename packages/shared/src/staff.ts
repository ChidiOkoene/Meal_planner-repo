import { z } from 'zod';

export const staffRoleSchema = z.enum(['dietitian', 'ops', 'admin']);
export type StaffRole = z.infer<typeof staffRoleSchema>;

/** Body of `POST /v1/ops/staff/invitations` (admins only). */
export const staffInvitationSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: staffRoleSchema,
});
export type StaffInvitation = z.infer<typeof staffInvitationSchema>;

export const staffRoleParamsSchema = z.object({
  userId: z.uuid(),
  role: staffRoleSchema,
});

/**
 * Body of the staff authenticator endpoints: a 6-digit code from the app, or a backup code
 * such as "K7M2Q-9XHT4".
 */
export const staffTwoFactorCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, 'Enter the 6-digit code from your authenticator app')
    .max(20, 'That code is too long'),
});
export type StaffTwoFactorCode = z.infer<typeof staffTwoFactorCodeSchema>;

export const staffUserParamsSchema = z.object({ userId: z.uuid() });
