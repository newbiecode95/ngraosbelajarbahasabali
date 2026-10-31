import { betterAuth } from 'better-auth';
import { getPool } from './db';
import { authSecret, origin } from './config';
function createAuth() {
  return betterAuth({
    appName: 'Ngraos!', baseURL: origin(), secret: authSecret(), database: getPool(),
    trustedOrigins: [origin(), ...(process.env.AUTH_TRUSTED_ORIGINS || '').split(',').filter(Boolean)],
    emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128, requireEmailVerification: false },
    session: { expiresIn: 60*60*24*14, updateAge: 60*60*24, cookieCache: {enabled: false} },
    rateLimit: {enabled: true, window:60, max:20},
    advanced: { cookiePrefix: 'ngraos', useSecureCookies: origin().startsWith('https://'), defaultCookieAttributes:{sameSite:'lax',httpOnly:true}, database: {generateId: 'uuid'} },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
