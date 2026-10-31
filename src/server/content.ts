import { eq } from 'drizzle-orm';
import { lessons } from '../content/lessons';
import type { CorpusEntry, Lesson, LevelId } from '../lib/types';
import { getDb, query } from './db';
import { corpusEntries } from './schema';
import { AppError } from './errors';
import { embed } from './openrouter';
import { models } from './config';
import { normalize } from './rules';
import type { PoolClient } from 'pg';
export const levelOrder:LevelId[]=['warung','kos','pasar','boss'];
export function lessonById(id:string):Lesson {
  const lesson=lessons.find(l=>l.id===id);
  if(!lesson) throw new AppError(404,'LEVEL_NOT_FOUND','Lokasi tidak ditemukan.');
  return lesson;
}
export async function eligibleEntries(levelId:LevelId,client?:PoolClient):Promise<CorpusEntry[]> {
  const rows=client?(await client.query<{entry:CorpusEntry}>('SELECT entry FROM corpus_entries WHERE enabled=true')).rows:await getDb().select({entry:corpusEntries.entry}).from(corpusEntries).where(eq(corpusEntries.enabled,true));
  return rows.map(r=>r.entry).filter(e=>e.status!=='draft'&&(levelId==='boss'||e.levelIds.includes(levelId)));
}
export async function retrieve(text:string,levelId:LevelId,playerId:string,client?:PoolClient) {
  const execute=client?client.query.bind(client):query;
  const entries=await eligibleEntries(levelId,client);
  if(!entries.length) throw new AppError(503,'CONTENT_NOT_READY','Materi lokasi ini sedang disiapkan. Silakan coba lagi nanti.',true);
  const tokens=new Set(normalize(text).split(' ').filter(t=>t.length>1));
  const scores=new Map(entries.map(entry=>[entry.id,normalize(`${entry.bali} ${entry.indonesia} ${entry.english}`).split(' ').reduce((n,t)=>n+(tokens.has(t)?1:0),0)]));
  // An exact sourced phrase already supplies stronger evidence than approximate similarity.
  // Keep common, correct utterances on the local retrieval path to avoid an unnecessary API hop.
  const exactMatches=entries.filter(entry=>[entry.bali,...entry.variants].some(value=>normalize(value)===normalize(text)));
  for(const entry of exactMatches)scores.set(entry.id,100);
  const embedded=exactMatches.length?null:await execute('SELECT count(*)::int AS n FROM corpus_entries WHERE enabled=true AND embedding IS NOT NULL AND embedding_model=$1',[models().embedding]);
  if(embedded&&Number(embedded.rows[0]?.n)>0) {
    try {
      const [vector]=await embed([text],playerId,client);
      const candidates=await execute(`SELECT id,(embedding <=> $1::vector) AS distance FROM corpus_entries WHERE enabled=true AND embedding IS NOT NULL AND embedding_model=$2 ORDER BY embedding <=> $1::vector LIMIT 16`,[`[${vector.join(',')}]`,models().embedding]);
      for(const candidate of candidates.rows) if(scores.has(candidate.id)) scores.set(candidate.id,(scores.get(candidate.id)||0)+Math.max(0,2-Number(candidate.distance)));
    } catch { /* Grounded lexical retrieval remains available when embedding service is unavailable. */ }
  }
  const lesson=lessonById(levelId);
  const required=new Set(lesson.phrases);
  const ranked=[...entries].sort((a,b)=>(scores.get(b.id)||0)-(scores.get(a.id)||0));
  const selected=[...entries.filter(e=>required.has(e.id)),...ranked];
  return [...new Map(selected.map(e=>[e.id,e])).values()].slice(0,32);
}
