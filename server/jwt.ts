import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';

export interface CustomerJwtPayload {
  sub: string;
  email: string;
  user_role: string;
  type: 'customer';
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: string;
  user_role: string;
  type: 'admin';
  jti: string;
  iat?: number;
  exp?: number;
}

export type AppJwtPayload = CustomerJwtPayload | AdminJwtPayload;

let cachedSecret: string | null = null;

function getJwtSecret(): string {
  if (cachedSecret) return cachedSecret;

  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret && envSecret.length >= 8) {
    cachedSecret = envSecret;
    return cachedSecret;
  }

  // On serverless platforms (e.g. Vercel), local disk (.data/jwt.secret) is not shared
  // across invocations. Derive a deterministic secret from MONGODB_URI when JWT_SECRET is unset
  // so tokens remain valid across all warm/cold serverless instances.
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    const seed = process.env.MONGODB_URI?.trim() || process.env.APP_URL?.trim() || 'shopadmin-prod-key';
    cachedSecret = crypto
      .createHmac('sha256', 'shopadmin-serverless-jwt-v1')
      .update(seed)
      .digest('hex');
    return cachedSecret;
  }

  const secretDir = path.resolve(process.cwd(), '.data');
  const secretFile = path.join(secretDir, 'jwt.secret');
  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf8').trim();
      if (existing.length >= 32) {
        cachedSecret = existing;
        return cachedSecret;
      }
    }
    fs.mkdirSync(secretDir, { recursive: true });
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    cachedSecret = generated;
    return cachedSecret;
  } catch {
    cachedSecret = crypto.randomBytes(48).toString('hex');
    return cachedSecret;
  }
}

export function signCustomerJwt(params: {
  userId: string;
  email: string;
  userRole?: string;
  jti: string;
}): string {
  const payload: CustomerJwtPayload = {
    sub: params.userId,
    email: params.email,
    user_role: params.userRole || 'customer',
    type: 'customer',
    jti: params.jti,
  };
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: '30d',
  });
}

export function signAdminJwt(params: {
  adminId: string;
  email: string;
  role: string;
  userRole: string;
  jti: string;
}): string {
  const payload: AdminJwtPayload = {
    sub: params.adminId,
    email: params.email,
    role: params.role,
    user_role: params.userRole,
    type: 'admin',
    jti: params.jti,
  };
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: '7d',
  });
}

export function verifyJwtToken(token: string): AppJwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    });
    if (!decoded || typeof decoded !== 'object') return null;
    const payload = decoded as Partial<AppJwtPayload>;
    if (!payload.sub || !payload.jti || (payload.type !== 'customer' && payload.type !== 'admin')) {
      return null;
    }
    return payload as AppJwtPayload;
  } catch {
    return null;
  }
}
