import 'dotenv/config';
import { corpus } from '../src/content/corpus';
import { getPool, query, transaction } from '../src/server/db';
import { embed } from '../src/server/openrouter';
import { models } from '../src/server/config';
import type { CorpusEntry } from '../src/lib/types';
async function main() {
  await transaction(async client=>{
    for(const entry of corpus)await client.query(`INSERT INTO corpus_entries(id,entry) VALUES($1,$2)
      ON CONFLICT(id) DO UPDATE SET entry=CASE WHEN corpus_entries.entry - 'status' = EXCLUDED.entry - 'status' AND corpus_entries.entry->>'status'='ai-reviewed' AND EXCLUDED.entry->>'status'='sourced' THEN jsonb_set(EXCLUDED.entry,'{status}',corpus_entries.entry->'status') ELSE EXCLUDED.entry END,
      embedding=CASE WHEN corpus_entries.entry - 'status' = EXCLUDED.entry - 'status' THEN corpus_entries.embedding ELSE NULL END,
      updated_at=now()`,[entry.id,JSON.stringify(entry)]);
  });
  console.log(`Seeded ${corpus.length} corpus entries with source metadata.`);
  if(process.argv.includes('--embed')) {
    const entries=(await query<{id:string;entry:CorpusEntry}>("SELECT id,entry FROM corpus_entries WHERE enabled=true AND entry->>'status'<>'draft' AND (embedding IS NULL OR embedding_model IS DISTINCT FROM $1)",[models().embedding])).rows;
    for(let offset=0;offset<entries.length;offset+=16) {
      const batch=entries.slice(offset,offset+16);const vectors=await embed(batch.map(({entry:e})=>`${e.bali}\n${e.indonesia}\n${e.english}\n${e.category}`));
      for(let i=0;i<batch.length;i++)await query('UPDATE corpus_entries SET embedding=$2::vector,embedding_model=$3 WHERE id=$1',[batch[i].id,`[${vectors[i].join(',')}]`,models().embedding]);
      console.log(`Embedded ${Math.min(offset+16,entries.length)}/${entries.length}.`);
    }
  }
}
main().catch(error=>{console.error('Seed failed:',error instanceof Error?error.message:'Unknown error');process.exitCode=1;}).finally(()=>getPool().end());
