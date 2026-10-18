import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { TOTP, Secret } from 'otpauth';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { storeConfig } from '../config.js';
import { allowedRequestOrigin } from '../services/security.js';
import { digest, fail, atomic, email, addressSchema, id, ApiError } from '../services/core.js';
import type { Session, User } from '../generated/prisma/client.js';

declare global {
  namespace Express {
    interface Request {
      shopSession?: Session & { user: User | null };
    }
  }
}
const cookieName = storeConfig.mode === 'production' ? '__Host-kvist_session' : 'kvist_session';
const random = () => randomBytes(32).toString('hex');
export const safeUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  emailVerified: !!u.emailVerifiedAt,
  mfaEnabled: !!u.totpSecret,
  requiresPasswordChange: u.requiresPasswordChange,
});
export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (
    req.method === 'GET' &&
    /^\/api\/v1\/(config|categories|products(?:\/[^/]+)?|product-prices|content\/[^/]+)$/.test(
      req.originalUrl.split('?')[0],
    )
  )
    return next();
  const token = req.cookies?.[cookieName];
  if (typeof token === 'string' && token.length === 64) {
    const s = await prisma.session.findUnique({
      where: { tokenHash: digest(token) },
      include: { user: true },
    });
    if (s && s.expiresAt > new Date() && !s.user?.disabled) req.shopSession = s;
  }
  next();
}
export async function createSession(
  req: Request,
  res: Response,
  userId?: string,
  mfaVerified = false,
) {
  const token = random();
  const s = await prisma.session.create({
    data: {
      tokenHash: digest(token),
      csrfToken: random(),
      userId,
      mfaVerified,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
    include: { user: true },
  });
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: storeConfig.mode === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 86400000,
  });
  req.shopSession = s;
  return s;
}
export async function ensureSession(req: Request, res: Response) {
  return req.shopSession ?? createSession(req, res);
}
export { requireUser, requireAdmin } from '../middleware/authorization.js';
import { requireUser } from '../middleware/authorization.js';
export function csrf(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.get('X-CSRF-Token');
  const expected = req.shopSession?.csrfToken;
  if (
    !token ||
    !expected ||
    Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  )
    fail(403, 'CSRF_INVALID', 'Your session has changed. Refresh and try again.');
  const origin = req.get('origin');
  if (
    origin &&
    !allowedRequestOrigin(
      origin,
      process.env.PUBLIC_APP_URL ?? 'http://127.0.0.1:3001',
      `${req.protocol}://${req.get('host')}`,
      storeConfig.mode !== 'production',
    )
  )
    fail(403, 'ORIGIN_INVALID', 'Request origin is not allowed.');
  next();
}
async function finishLogin(req: Request, res: Response, user: User) {
  const old = req.shopSession;
  const guest = old
    ? await prisma.cart.findUnique({ where: { sessionId: old.id }, include: { items: true } })
    : null;
  if (guest)
    await atomic(async (tx) => {
      const cart = await tx.cart.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          marketId: guest?.marketId ?? storeConfig.defaultMarketId,
          currency: guest?.currency ?? storeConfig.currencies[0].code,
        },
        update: {},
      });
      if (guest) {
        for (const item of guest.items) {
          const existing = await tx.cartItem.findUnique({
            where: {
              cartId_variantId: { cartId: cart.id, variantId: item.variantId },
            },
          });
          await tx.cartItem.upsert({
            where: {
              cartId_variantId: { cartId: cart.id, variantId: item.variantId },
            },
            create: {
              cartId: cart.id,
              variantId: item.variantId,
              quantity: item.quantity,
            },
            update: {
              quantity: Math.min(
                storeConfig.checkout.maxQuantityPerSku,
                item.quantity + (existing?.quantity ?? 0),
              ),
            },
          });
        }
        await tx.cart.delete({ where: { id: guest.id } });
        await tx.cart.update({
          where: { id: cart.id },
          data: { version: { increment: 1 } },
        });
      }
    });
  if (old) await prisma.session.update({ where: { id: old.id }, data: { expiresAt: new Date() } });
  const s = await createSession(req, res, user.id, !!user.totpSecret);
  res.json({ data: { user: safeUser(user), csrfToken: s.csrfToken } });
}
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const credentials = z.object({
  email: z.email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(10).max(128),
  name: z.string().trim().min(2).max(80).optional(),
  code: z.string().optional(),
});
export const auth = Router();
auth.get('/csrf', async (req, res) => {
  const s = await ensureSession(req, res);
  res.set('Cache-Control', 'no-store').json({ data: { csrfToken: s.csrfToken } });
});
auth.get('/me', async (req, res) => {
  res.set('Cache-Control', 'no-store').json({
    data: {
      user: req.shopSession?.user ? safeUser(req.shopSession.user) : null,
      csrfToken: req.shopSession?.csrfToken ?? null,
    },
  });
});
auth.post('/register', authLimit, async (req, res) => {
  const data = credentials.parse(req.body);
  if (!data.name) fail(422, 'VALIDATION_FAILED', 'Your name is required.');
  if (await prisma.user.findUnique({ where: { email: data.email } }))
    fail(409, 'EMAIL_IN_USE', 'This email cannot be registered. Try signing in.');
  const u = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash: await hash(data.password),
    },
  });
  await issueUserToken(u, 'VERIFY');
  await finishLogin(req, res, u);
});
auth.post('/login', authLimit, async (req, res) => {
  const data = credentials
    .extend({
      email: z
        .string()
        .trim()
        .min(1)
        .max(254)
        .transform((v) => v.toLowerCase()),
      password: z.string().min(1).max(128),
    })
    .parse(req.body);
  const u = await prisma.user.findFirst({
    where: { OR: [{ email: data.email }, { username: data.email }] },
  });
  if (!u || u.disabled || !(await verify(u.passwordHash, data.password)))
    fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  if (
    u.requiresPasswordChange &&
    (storeConfig.mode === 'production' || process.env.NODE_ENV === 'production')
  )
    fail(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'Replace the development administrator password using admin:create before production sign in.',
    );
  if (u.totpSecret && (!data.code || !validTotp(decrypt(u.totpSecret), data.code)))
    fail(401, 'MFA_REQUIRED', 'Enter your current authenticator code.');
  await finishLogin(req, res, u);
});
auth.post('/demo', authLimit, async (req, res) => {
  if (
    storeConfig.mode !== 'demo' ||
    !storeConfig.features.demoAdmin ||
    process.env.DEMO_SEED !== 'true'
  )
    fail(404, 'NOT_FOUND', 'Demo sign in is unavailable.');
  const u = await prisma.user.findUnique({
    where: { email: 'demo@kvist.example' },
  });
  if (!u) fail(503, 'DEMO_UNAVAILABLE', 'Demo data has not been initialized.');
  await finishLogin(req, res, u);
});
auth.post('/logout', async (req, res) => {
  if (req.shopSession)
    await prisma.session.update({
      where: { id: req.shopSession.id },
      data: { expiresAt: new Date() },
    });
  res.clearCookie(cookieName, { path: '/' });
  res.json({ data: { ok: true } });
});
async function issueUserToken(user: User, purpose: string) {
  const token = random();
  await atomic(async (tx) => {
    await tx.authToken.create({
      data: {
        userId: user.id,
        tokenHash: digest(token),
        purpose,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const route = purpose === 'VERIFY' ? 'verify-email' : 'reset-password';
    await email(
      tx,
      user.email,
      purpose === 'VERIFY' ? 'Verify your email' : 'Reset your password',
      `${process.env.PUBLIC_APP_URL ?? 'http://127.0.0.1:3001'}/${route}#token=${token}`,
    );
  });
}
auth.post('/forgot-password', authLimit, async (req, res) => {
  const { email: address } = z
    .object({ email: z.email().transform((v) => v.toLowerCase()) })
    .parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: address } });
  if (user) await issueUserToken(user, 'RESET');
  res.json({
    data: {
      message: 'If an account exists, a reset link has been queued for delivery.',
    },
  });
});
auth.post('/reset-password', authLimit, async (req, res) => {
  const { token, password } = z
    .object({
      token: z.string().length(64),
      password: z.string().min(10).max(128),
    })
    .parse(req.body);
  const passwordHash = await hash(password);
  await atomic(async (tx) => {
    const t = await tx.authToken.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (!t || t.purpose !== 'RESET' || !t.userId || t.usedAt || t.expiresAt < new Date())
      fail(422, 'TOKEN_INVALID', 'This link has expired or was used.');
    await tx.user.update({
      where: { id: t.userId },
      data: { passwordHash, requiresPasswordChange: false },
    });
    await tx.session.updateMany({
      where: { userId: t.userId },
      data: { expiresAt: new Date() },
    });
    await tx.authToken.update({
      where: { id: t.id },
      data: { usedAt: new Date() },
    });
  });
  res.json({ data: { ok: true } });
});
auth.post('/verify-email', async (req, res) => {
  const { token } = z.object({ token: z.string().length(64) }).parse(req.body);
  await atomic(async (tx) => {
    const t = await tx.authToken.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (!t || t.purpose !== 'VERIFY' || !t.userId || t.usedAt || t.expiresAt < new Date())
      fail(422, 'TOKEN_INVALID', 'This link is no longer valid.');
    await tx.user.update({
      where: { id: t.userId },
      data: { emailVerifiedAt: new Date() },
    });
    await tx.authToken.update({
      where: { id: t.id },
      data: { usedAt: new Date() },
    });
  });
  res.json({ data: { ok: true } });
});
auth.post('/order-access/request', authLimit, async (req, res) => {
  const d = z
    .object({
      email: z.email().transform((x) => x.toLowerCase()),
      number: z.string().max(40),
    })
    .parse(req.body);
  const o = await prisma.order.findFirst({
    where: { email: d.email, number: d.number },
  });
  if (o) {
    const token = random();
    await atomic(async (tx) => {
      await tx.authToken.create({
        data: {
          tokenHash: digest(token),
          purpose: 'ORDER',
          targetId: o.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      await email(
        tx,
        d.email,
        'Your order access link',
        `${process.env.PUBLIC_APP_URL ?? 'http://127.0.0.1:3001'}/order-access#token=${token}`,
      );
    });
  }
  res.json({
    data: { message: 'If the details match, an access link has been queued.' },
  });
});
auth.post('/order-access/consume', async (req, res) => {
  const { token } = z.object({ token: z.string().length(64) }).parse(req.body);
  const s = req.shopSession!;
  const orderId = await atomic(async (tx) => {
    const t = await tx.authToken.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (!t || t.purpose !== 'ORDER' || t.usedAt || t.expiresAt < new Date())
      fail(422, 'TOKEN_INVALID', 'This access link has expired.');
    await tx.session.update({
      where: { id: s.id },
      data: { guestOrderId: t.targetId },
    });
    await tx.authToken.update({
      where: { id: t.id },
      data: { usedAt: new Date() },
    });
    return t.targetId;
  });
  res.json({ data: { ok: true, orderId } });
});
function encryptionKey() {
  const k = process.env.MFA_ENCRYPTION_KEY;
  if (!k || !/^[a-fA-F0-9]{64}$/.test(k))
    throw new ApiError(503, 'MFA_CONFIG', 'MFA encryption is not configured.');
  return Buffer.from(k, 'hex');
}
function encrypt(s: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  return JSON.stringify([
    iv.toString('hex'),
    Buffer.concat([c.update(s), c.final()]).toString('hex'),
    c.getAuthTag().toString('hex'),
  ]);
}
function decrypt(s: string) {
  const [iv, body, tag] = JSON.parse(s) as string[];
  const c = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'hex'));
  c.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([c.update(Buffer.from(body, 'hex')), c.final()]).toString();
}
function validTotp(secret: string, code: string) {
  return (
    new TOTP({ secret: Secret.fromBase32(secret) }).validate({
      token: code,
      window: 1,
    }) !== null
  );
}
export const account = Router();
account.use(requireUser);
account.get('/', (req, res) => res.json({ data: safeUser(req.shopSession!.user!) }));
account.patch('/', async (req, res) => {
  const d = z
    .object({ name: z.string().trim().min(2).max(80) })
    .strict()
    .parse(req.body);
  res.json({
    data: safeUser(
      await prisma.user.update({
        where: { id: req.shopSession!.userId! },
        data: d,
      }),
    ),
  });
});
account.get('/addresses', async (req, res) =>
  res.json({
    data: await prisma.address.findMany({
      where: { userId: req.shopSession!.userId! },
    }),
  }),
);
account.post('/addresses', async (req, res) => {
  const d = addressSchema.extend({ label: z.string().max(50).default('Home') }).parse(req.body);
  res.status(201).json({
    data: await prisma.address.create({
      data: { ...d, userId: req.shopSession!.userId! },
    }),
  });
});
account.delete('/addresses/:id', async (req, res) => {
  await prisma.address.deleteMany({
    where: { id: id.parse(req.params.id), userId: req.shopSession!.userId! },
  });
  res.json({ data: { ok: true } });
});
account.post('/mfa/setup', async (req, res) => {
  const { password } = z.object({ password: z.string() }).parse(req.body);
  if (!(await verify(req.shopSession!.user!.passwordHash, password)))
    fail(401, 'INVALID_CREDENTIALS', 'Password is incorrect.');
  const secret = new Secret({ size: 20 }).base32;
  const token = random();
  await prisma.authToken.create({
    data: {
      userId: req.shopSession!.userId!,
      tokenHash: digest(token),
      purpose: 'MFA',
      targetId: encrypt(secret),
      expiresAt: new Date(Date.now() + 600000),
    },
  });
  res.json({
    data: {
      secret,
      token,
      uri: new TOTP({
        issuer: storeConfig.brand.name,
        label: req.shopSession!.user!.email,
        secret: Secret.fromBase32(secret),
      }).toString(),
    },
  });
});
account.post('/mfa/enable', async (req, res) => {
  const { token, code } = z
    .object({ token: z.string(), code: z.string().length(6) })
    .parse(req.body);
  await atomic(async (tx) => {
    const t = await tx.authToken.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (
      !t ||
      t.userId !== req.shopSession!.userId ||
      t.purpose !== 'MFA' ||
      t.usedAt ||
      t.expiresAt < new Date() ||
      !validTotp(decrypt(t.targetId!), code)
    )
      fail(422, 'MFA_INVALID', 'Authenticator code is incorrect.');
    await tx.user.update({
      where: { id: t.userId! },
      data: { totpSecret: t.targetId },
    });
    await tx.session.updateMany({
      where: { userId: t.userId!, id: { not: req.shopSession!.id } },
      data: { expiresAt: new Date() },
    });
    await tx.session.update({ where: { id: req.shopSession!.id }, data: { mfaVerified: true } });
    await tx.authToken.update({
      where: { id: t.id },
      data: { usedAt: new Date() },
    });
  });
  res.json({ data: { ok: true } });
});
