import 'dotenv/config';
import { query, getPool } from '../src/server/db';
import { repairTurnReply, type SessionRow } from '../src/server/game';
import type { ActorRow } from '../src/server/actors';
import { replyNeedsRepair } from '../src/lib/learning-text';

// Dry-run by default. No player text, raw replies or credentials enter logs.
async function main() {
  const apply = process.argv.includes('--apply');
  const sessions = (await query<SessionRow>('SELECT * FROM game_sessions ORDER BY created_at')).rows;
  let affected = 0, repaired = 0, failed = 0;
  for (const session of sessions) {
    for (const turn of session.turns.filter(replyNeedsRepair)) {
      affected++;
      if (!apply) continue;
      const actor = (await query<ActorRow>('SELECT * FROM players WHERE id=$1', [session.player_id])).rows[0];
      if (!actor) { failed++; continue; }
      try { await repairTurnReply(actor, session.id, turn.id); repaired++; }
      catch { failed++; }
    }
  }
  console.log(JSON.stringify({ apply, affected, repaired, failed }));
  if (failed) process.exitCode = 1;
}
main().catch(() => { console.error('Legacy reply repair unavailable.'); process.exitCode = 1; }).finally(() => getPool().end());
