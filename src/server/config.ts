import { AppError } from './errors';
export const models = () => ({
  roleplay: process.env.AI_ROLEPLAY_MODEL || 'openai/gpt-6.1-sol',
  transcribe: process.env.AI_TRANSCRIBE_MODEL || 'google/gemini-3.8-flash',
  review: process.env.AI_REVIEW_MODEL || 'google/gemini-3.8-flash',
  tts: process.env.AI_TTS_MODEL || 'google/gemini-3.8-flash-tts',
  ttsFallback: process.env.AI_TTS_FALLBACK_MODEL || 'google/gemini-3.8-flash-lite-tts',
  embedding: process.env.AI_EMBEDDING_MODEL || 'openai/text-embedding-3-large',
});
export const EMBEDDING_DIMENSIONS = 1536;
export const origin = () => process.env.BETTER_AUTH_URL || process.env.APP_URL || 'http://localhost:3000';
export const aiReady = () => Boolean(process.env.OPENROUTER_API_KEY);
export const demoOnly = () => process.env.DEMO_ONLY !== 'false';
export function apiKey() {
  if (!process.env.OPENROUTER_API_KEY) throw new AppError(503, 'AI_NOT_CONFIGURED', 'Layanan AI belum dikonfigurasi. Anda tetap dapat menjelajahi desa.', true);
  return process.env.OPENROUTER_API_KEY;
}
export function authSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new AppError(503, 'AUTH_NOT_CONFIGURED', 'Konfigurasi akun belum siap.', true);
  return secret;
}
