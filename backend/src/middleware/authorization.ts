import type { Request, Response, NextFunction } from 'express';
import { storeConfig } from '../config.js';
import { fail } from '../services/errors.js';

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  const session = req.shopSession;
  if (!session?.user || session.expiresAt <= new Date() || session.user.disabled)
    fail(401, 'AUTH_REQUIRED', 'Please sign in to continue.');
  next();
}

// Mounted once before every admin route, including nested media routes and exports.
// Identity and role come from the database-backed session, never request bodies or headers.
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const session = req.shopSession;
  if (
    !session?.user ||
    session.expiresAt <= new Date() ||
    session.user.disabled ||
    session.user.role !== 'ADMIN'
  )
    fail(403, 'FORBIDDEN', 'Administrator access is required.');
  if (
    session.user.requiresPasswordChange &&
    (storeConfig.mode === 'production' || process.env.NODE_ENV === 'production')
  )
    fail(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'Replace the development administrator password before production operations.',
    );
  if (storeConfig.mode === 'production' && (!session.user.totpSecret || !session.mfaVerified))
    fail(
      403,
      'MFA_ENROLLMENT_REQUIRED',
      'Enable administrator MFA in account settings before operating this production store.',
    );
  next();
}
