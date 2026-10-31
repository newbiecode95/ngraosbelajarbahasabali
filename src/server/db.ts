import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { AppError } from './errors';
let pool: Pool | undefined;
const afterTransactionWrites=new WeakMap<PoolClient,{sql:string;values:unknown[]}[]>();
export function deferTransactionWrite(client:PoolClient,sql:string,values:unknown[]) {
  const pending=afterTransactionWrites.get(client);
  if(!pending)return false;
  pending.push({sql,values});return true;
}
export function getPool() {
  if (!process.env.DATABASE_URL) throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'Penyimpanan belum dikonfigurasi. Silakan coba lagi nanti.', true);
  return pool ??= new Pool({connectionString: process.env.DATABASE_URL, max: 25, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, statement_timeout: 60_000});
}
export const getDb = () => drizzle(getPool(),{schema});
export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  return getPool().query<T>(sql,values);
}
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client=await getPool().connect();
  afterTransactionWrites.set(client,[]);
  try { await client.query('BEGIN'); const result=await fn(client); await client.query('COMMIT'); return result; }
  catch(error) { await client.query('ROLLBACK'); throw error; }
  finally {
    // Paid usage survives a gameplay rollback without acquiring a second pool connection.
    // Run these independent writes after COMMIT/ROLLBACK, then return the client to the pool.
    const pending=afterTransactionWrites.get(client)||[];afterTransactionWrites.delete(client);
    for(const write of pending)try{await client.query(write.sql,write.values);}catch{console.warn('Deferred AI usage recording unavailable');}
    client.release();
  }
}
