import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Unesite ispravnu email adresu'),
  password: z.string().min(1, 'Lozinka je obavezna'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(12, 'Lozinka mora imati najmanje 12 karaktera')
      .regex(/[a-z]/, 'Lozinka mora sadržati malo slovo')
      .regex(/[A-Z]/, 'Lozinka mora sadržati veliko slovo')
      .regex(/[0-9]/, 'Lozinka mora sadržati cifru'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Lozinke se ne poklapaju',
    path: ['confirmPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const ADMIN_ROLES = ['OWNER', 'EDITOR'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Claims carried by the short-lived access JWT. */
export interface AccessTokenClaims {
  sub: string;
  role: AdminRole;
  mustChangePassword: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  mustChangePassword: boolean;
}
