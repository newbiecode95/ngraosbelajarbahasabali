import { pgTable, text, integer, boolean, timestamp, jsonb, customType, uuid } from 'drizzle-orm/pg-core';
import type { CorpusEntry, GameSession, LevelId, SessionResult, Turn } from '../lib/types';
const vector = customType<{ data: number[]; driverData: string }>({dataType: () => 'vector(1536)',toDriver: (v) => `[${v.join(',')}]`,fromDriver: (v) => JSON.parse(v)});
export const players = pgTable('players', {
  id: text('id').primaryKey(), authUserId: uuid('auth_user_id').unique(), name: text('name').notNull(), locale: text('locale').notNull().default('id'),
  demoTokenHash: text('demo_token_hash').unique(), expiresAt: timestamp('expires_at',{withTimezone:true}), xp: integer('xp').notNull().default(0), streak: integer('streak').notNull().default(0), lastActiveDate: text('last_active_date'),
  demoNameSet: boolean('demo_name_set').notNull().default(false),
  stars: jsonb('stars').$type<Partial<Record<LevelId,number>>>().notNull().default({}), albums: jsonb('albums').$type<LevelId[]>().notNull().default([]), createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
});
export const gameSessions = pgTable('game_sessions', {
  id: text('id').primaryKey(), playerId: text('player_id').notNull().references(()=>players.id,{onDelete:'cascade'}), levelId: text('level_id').notNull(), status: text('status').notNull().default('active'),
  turns: jsonb('turns').$type<Turn[]>().notNull().default([]), completedObjectives: jsonb('completed_objectives').$type<string[]>().notNull().default([]), hintsUsed: integer('hints_used').notNull().default(0),
  quiz: jsonb('quiz'), result: jsonb('result').$type<SessionResult>(), createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(), updatedAt: timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
  revealedHints: jsonb('revealed_hints').$type<string[]>().notNull().default([]), quizAnswers: jsonb('quiz_answers').$type<Record<string,{answer:string;correct:boolean}>>().notNull().default({}),
});
export const corpusEntries = pgTable('corpus_entries', {
  id: text('id').primaryKey(), entry: jsonb('entry').$type<CorpusEntry>().notNull(), embedding: vector('embedding'), embeddingModel: text('embedding_model'), enabled: boolean('enabled').notNull().default(true), updatedAt: timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});
export const aiUsage = pgTable('ai_usage', {
  id: text('id').primaryKey(), playerId: text('player_id').references(()=>players.id,{onDelete:'cascade'}), stage: text('stage').notNull(), model: text('model').notNull(), provider: text('provider'), inputTokens: integer('input_tokens').notNull().default(0), outputTokens: integer('output_tokens').notNull().default(0), latencyMs: integer('latency_ms').notNull(), metadata: jsonb('metadata'), createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
});
export type StoredSession = GameSession;
