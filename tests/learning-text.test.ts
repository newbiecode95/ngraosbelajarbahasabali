import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasUnexpectedLearningScript, publicTurn } from '../src/lib/learning-text';
import { roleplay, transcribe, repairReply } from '../src/server/openrouter';
import { cachedSpeech } from '../src/server/audio';
import { lessons } from '../src/content/lessons';
import type { Turn } from '../src/lib/types';

const broken = 'Rahajeng semeng. Jagi ngopi napi ng 茶?';
const good = { reply: 'Rahajeng semeng. Jagi ngopi napi teh?', translation: { id: 'Selamat pagi. Mau kopi atau teh?', en: 'Good morning. Coffee or tea?' }, objectiveEvidence: [], corrections: [] };
const old: Turn = { id: 'old', playerText: 'Nama saya 茶.', reply: broken, translation: good.translation, corrections: [], objectiveIds: [], createdAt: '2026-11-01' };
const input = { lesson: lessons[0], text: 'Rahajeng semeng.', turns: [], entries: [], completedObjectives: [], playerId: 'test' };

beforeEach(() => { vi.stubEnv('OPENROUTER_API_KEY', 'test-only'); vi.stubEnv('DATABASE_URL', ''); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function response(value: unknown) { return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }), { status: 200 }); }

describe('Latin-script learning text', () => {
  it('accepts Balinese diacritics and punctuation, rejects stray foreign scripts and broken encoding', () => {
    for (const text of ['Rahajeng semeng.', 'Basa Bali: é, è, ê, ā, ĕ, ṅ.', 'Aji 10.000? “Nggih!”']) expect(hasUnexpectedLearningScript(text)).toBe(false);
    for (const text of [broken, 'Nggih, спасибо.', 'Nggih �', 'Nggih\u202E']) expect(hasUnexpectedLearningScript(text)).toBe(true);
  });
  it('withholds a legacy bad reply while preserving the player text and stored original', () => {
    const visible = publicTurn(old);
    expect(visible.replyUnavailable).toBe(true); expect(visible.reply).toBe('');
    expect(visible.playerText).toBe(old.playerText); expect(old.reply).toBe(broken);
  });
  it('repairs one invalid model response and accepts a validated replacement', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ ...good, reply: broken })).mockResolvedValueOnce(response(good));
    vi.stubGlobal('fetch', fetch);
    expect((await roleplay(input)).reply).toBe(good.reply);
    expect(fetch).toHaveBeenCalledTimes(2);
    const retry = JSON.parse(fetch.mock.calls[1][1].body);
    expect(retry.messages.at(-2).content).toContain('茶');
    expect(retry.messages.at(-1).content).toContain('Latin alphabet');
  });
  it('fails after one repair and never silently strips the offending letter', async () => {
    const fetch = vi.fn().mockImplementation(async () => response({ ...good, reply: broken })); vi.stubGlobal('fetch', fetch);
    await expect(roleplay(input)).rejects.toMatchObject({ code: 'AI_INVALID_OUTPUT' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('also validates translations and correction explanations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => response({ ...good, translation: { ...good.translation, id: 'Selamat pagi 茶.' } })));
    await expect(roleplay(input)).rejects.toMatchObject({ code: 'AI_INVALID_OUTPUT' });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => response({ ...good, corrections: [{ said: 'sukse', correct: 'Suksma.', type: 'vocabulary', reason: { id: 'Gunakan 茶.', en: 'Use thanks.' }, sourceId: 'test' }] })));
    await expect(roleplay(input)).rejects.toMatchObject({ code: 'AI_INVALID_OUTPUT' });
  });
  it('never passes legacy broken text to speech or repeats it as assistant context', async () => {
    const fetch = vi.fn().mockResolvedValue(response(good)); vi.stubGlobal('fetch', fetch);
    await expect(cachedSpeech(broken, 'Kore')).rejects.toMatchObject({ code: 'REPLY_NEEDS_REPAIR' });
    expect(fetch).not.toHaveBeenCalled();
    await roleplay({ ...input, turns: [old] });
    const messages = JSON.parse(fetch.mock.calls[0][1].body).messages;
    expect(messages.filter((m: { role: string }) => m.role === 'assistant').some((m: { content: string }) => m.content.includes('茶'))).toBe(false);
  });
  it('preserves verbatim transcription even when a player uses another script', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ transcript: '茶', speechDetected: true })));
    expect((await transcribe(Buffer.from('fixture'), lessons[0], 'test')).rawTranscript).toBe('茶');
  });
  it('repairs an existing reply without returning assessment fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ reply: good.reply, translation: good.translation })));
    expect(await repairReply({ lesson: lessons[0], turn: old, playerId: 'test' })).toEqual({ reply: good.reply, translation: good.translation });
  });
});
