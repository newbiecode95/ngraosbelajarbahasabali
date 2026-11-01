export type Locale = "id" | "en";
export type Localized = { id: string; en: string };
export type LevelId = "warung" | "kos" | "pasar" | "boss";
export interface Objective {
  id: string;
  title: Localized;
  evidence: string[];
}
export interface Lesson {
  id: LevelId;
  number: number;
  title: string;
  subtitle: Localized;
  npc: string;
  role: Localized;
  description: Localized;
  objectives: Objective[];
  opening: string;
  openingTranslation: Localized;
  voice: string;
  color: string;
  phrases: string[];
  album: { title: Localized; text: Localized };
}
export interface CorpusEntry {
  id: string;
  bali: string;
  indonesia: string;
  english: string;
  category: string;
  register: string;
  levelIds: LevelId[];
  sourceUrl: string;
  sourceTitle: string;
  sourceRevision?: string;
  license: string;
  status: "draft" | "sourced" | "ai-reviewed";
  variants: string[];
}
export interface Correction {
  said: string;
  correct: string;
  type: "vocabulary" | "grammar" | "politeness";
  reason: Localized;
  sourceId: string;
  supported: boolean;
}
export interface Turn {
  id: string;
  playerText: string;
  rawTranscript?: string;
  reply: string;
  replyUnavailable?: boolean;
  translation: Localized;
  corrections: Correction[];
  objectiveIds: string[];
  assessed?: boolean;
  createdAt: string;
}
export interface QuizQuestion {
  id: string;
  type: "choice" | "order" | "repeat";
  prompt: Localized;
  options?: string[];
  words?: string[];
  target?: string;
  sourceId: string;
  mistakeId?: string;
  reinforcement: boolean;
}
export interface GameSession {
  id: string;
  levelId: LevelId;
  status: "active" | "quiz" | "completed";
  turns: Turn[];
  completedObjectives: string[];
  hintsUsed: number;
  revealedHints?: string[];
  quizResponses?: Record<string, QuizResponse>;
  quiz?: QuizQuestion[];
  result?: SessionResult;
}
export interface QuizResponse { answer: string; correct: boolean; expectedAnswer: string }
export interface SessionResult {
  stars: number;
  xp: number;
  quizScore: number;
  quizTotal: number;
  newAlbum: boolean;
  unlockedLevel?: LevelId;
  mistakesPracticed?: number;
  mistakesMastered?: number;
}
export interface Player {
  id: string;
  name: string;
  email?: string;
  locale: Locale;
  xp: number;
  streak: number;
  isDemo: boolean;
  isAdmin: boolean;
  stars: Partial<Record<LevelId, number>>;
  albums: LevelId[];
  activeSessionId?: string;
}
export interface ApiError {
  error: string;
  code?: string;
  retryable?: boolean;
}
