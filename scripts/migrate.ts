import 'dotenv/config';
import { getMigrations } from 'better-auth/db/migration';
import { getAuth } from '../src/server/auth';
import { getPool, transaction } from '../src/server/db';
import { migrationSql } from '../src/server/migration';
async function main() {
  const {runMigrations}=await getMigrations(getAuth().options);await runMigrations();
  await transaction(async client=>{await client.query("SELECT pg_advisory_xact_lock(hashtext('ngraos:migrations'))");await client.query(migrationSql);});
  console.log('Ngraos database migrations applied.');
}
main().catch(error=>{console.error('Migration failed:',error instanceof Error?error.message:'Unknown error');process.exitCode=1;}).finally(()=>getPool().end());
