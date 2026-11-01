import type { Correction, Turn } from './types';

// Lessons use Latin letters, including Balinese diacritics. Apply this only to
// generated learning text; preserve the player's original words verbatim.
export function hasUnexpectedLearningScript(text: string): boolean {
  if (/[\uFFFD\u200B-\u200F\u202A-\u202E\u2066-\u2069]/u.test(text)) return true;
  return [...text].some(char => /\p{Letter}/u.test(char) && !/\p{Script_Extensions=Latin}/u.test(char));
}

export function replyNeedsRepair(turn: Pick<Turn, 'reply' | 'translation' | 'replyUnavailable'>): boolean {
  return Boolean(turn.replyUnavailable) || !turn.reply.trim() ||
    [turn.reply, turn.translation.id, turn.translation.en].some(hasUnexpectedLearningScript);
}

export function correctionIsReadable(correction: Correction): boolean {
  return ![correction.correct, correction.reason.id, correction.reason.en].some(hasUnexpectedLearningScript);
}

export function publicTurn(turn: Turn): Turn {
  const corrections = turn.corrections.filter(correctionIsReadable);
  if (!replyNeedsRepair(turn)) return { ...turn, corrections };
  // Keep the original in storage for repair, rather than pretending a stripped
  // sentence or its Indonesian translation is valid Balinese learning material.
  return { ...turn, reply: '', translation: { id: '', en: '' }, corrections, replyUnavailable: true };
}
