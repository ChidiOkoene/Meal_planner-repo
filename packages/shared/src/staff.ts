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
