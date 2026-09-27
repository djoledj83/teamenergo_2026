import { Router } from 'express';
import { z } from 'zod';
import { changePasswordSchema, loginSchema } from '@teamenergo/shared';
import { HttpError } from '../errors.js';
import { asyncHandler, requireAuth } from '../middleware/auth.js';
import { loginRateLimit } from '../middleware/rate-limit.js';
import { validateBody } from '../middleware/validate.js';
import { recordAudit } from '../audit.js';
import * as auth from './service.js';

const refreshSchema = z.object({ refreshToken: z.string().min(1) });
const logoutSchema = z.object({ refreshToken: z.string().optional() });

export const authRouter: Router = Router();

function contextOf(req: { ip?: string | undefined; headers: Record<string, unknown> }) {
  return {
    ip: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

authRouter.post(
  '/login',
  loginRateLimit,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const result = await auth.login(email, password, contextOf(req));

    await recordAudit({
      adminUserId: result.user.id,
      action: 'auth.login',
      entity: 'AdminUser',
      entityId: result.user.id,
      ip: req.ip,
    });

    res.json(result);
  }),
);

authRouter.post(
  '/refresh',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    const result = await auth.refresh(refreshToken, contextOf(req));
    res.json(result);
  }),
);

authRouter.post(
  '/logout',
  validateBody(logoutSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as z.infer<typeof logoutSchema>;
    await auth.logout(refreshToken);
    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await auth.getUserById(req.auth!.sub);
    if (!user) throw HttpError.unauthorized();
    res.json({ user });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
    const adminUserId = req.auth!.sub;

    await auth.changePassword(adminUserId, currentPassword, newPassword);

    await recordAudit({
      adminUserId,
      action: 'auth.password_changed',
      entity: 'AdminUser',
      entityId: adminUserId,
      ip: req.ip,
    });

    // Every session was revoked, including this one — the client must sign in
    // again with the new password.
    res.status(204).end();
  }),
);
