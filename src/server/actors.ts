import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getAuth } from './auth';
import { query, transaction } from './db';
import { AppError } from './errors';
import { demoOnly, origin } from './config';
import type { Player, LevelId } from '../lib/types';
import type { PoolClient } from 'pg';
export const DEMO_COOKIE='ngraos_demo';
export interface ActorRow {id:string;auth_user_id:string|null;name:string;locale:'id'|'en';demo_token_hash:string|null;expires_at:Date|null;xp:number;streak:number;last_active_date:string|null;stars:Partial<Record<LevelId,number>>;albums:LevelId[];email?:string;emailVerified?:boolean;active_session_id?:string;demo_name_set?:boolean}
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export function cookieValue(request:Request,name:string) {
  const value=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
  return value ? decodeURIComponent(value) : undefined;
}
export async function findActor(request:Request):Promise<ActorRow|null> {
  const token=cookieValue(request,DEMO_COOKIE);
  if(token && /^[a-f0-9]{64}$/.test(token)) {
    const demo=await query<ActorRow>('SELECT * FROM players WHERE demo_token_hash=$1 AND expires_at>now()',[hashToken(token)]);
    if(demo.rows[0]) return demo.rows[0];
  }
  if(demoOnly())return null;
  const authSession=await getAuth().api.getSession({headers:request.headers});
  if(!authSession) return null;
  const id=randomUUID();
  const result=await query<ActorRow>(`INSERT INTO players(id,auth_user_id,name) VALUES($1,$2,$3)
    ON CONFLICT(auth_user_id) DO UPDATE SET auth_user_id=EXCLUDED.auth_user_id RETURNING *`,[id,authSession.user.id,authSession.user.name]);
  return {...result.rows[0],email:authSession.user.email,emailVerified:authSession.user.emailVerified};
}
export async function requireActor(request:Request) {
  const actor=await findActor(request);
  if(!actor) throw new AppError(401,'UNAUTHENTICATED','Masuk atau mulai demo untuk melanjutkan.');
  return actor;
}
export function isAdmin(actor:ActorRow) {
  if(!actor.auth_user_id)return false;
  if((process.env.ADMIN_USER_IDS||'').split(',').map(v=>v.trim()).includes(actor.auth_user_id))return true;
  return Boolean(actor.emailVerified && actor.email && (process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).includes(actor.email.toLowerCase()));
}
export async function requireAdmin(request:Request) {
  const actor=await requireActor(request);
  if(!isAdmin(actor)) throw new AppError(403,'FORBIDDEN','Halaman ini hanya untuk pengelola.');
  return actor;
}
export async function playerView(actor:ActorRow,client?:PoolClient):Promise<Player> {
  const active=await (client?client.query('SELECT id FROM game_sessions WHERE player_id=$1 AND status<>\'completed\' ORDER BY updated_at DESC LIMIT 1',[actor.id]):query('SELECT id FROM game_sessions WHERE player_id=$1 AND status<>\'completed\' ORDER BY updated_at DESC LIMIT 1',[actor.id]));
  return {id:actor.id,name:actor.name,email:actor.email,locale:actor.locale,xp:actor.xp,streak:actor.streak,isDemo:!actor.auth_user_id,needsName:!actor.auth_user_id&&!actor.demo_name_set,isAdmin:isAdmin(actor),stars:actor.stars,albums:actor.albums,activeSessionId:active.rows[0]?.id};
}
export async function createDemo(previous?:string,profile:{name?:string;locale?:'id'|'en'}={}) {
  const token=randomBytes(32).toString('hex');
  const actor=await transaction(async client=>{
    if(previous && /^[a-f0-9]{64}$/.test(previous)) await client.query('DELETE FROM players WHERE demo_token_hash=$1 AND auth_user_id IS NULL',[hashToken(previous)]);
    // Demo data expires after seven days. Never remove regular accounts.
    await client.query('DELETE FROM players WHERE auth_user_id IS NULL AND expires_at<now()');
    return (await client.query<ActorRow>("INSERT INTO players(id,name,locale,demo_token_hash,expires_at,demo_name_set) VALUES($1,$2,$3,$4,now()+interval '7 days',$5) RETURNING *",[randomUUID(),profile.name||'Tamiu',profile.locale||'id',hashToken(token),Boolean(profile.name)])).rows[0];
  });
  return {actor,token};
}
export function demoCookie(token:string,clear=false) {
  return `${DEMO_COOKIE}=${clear?'':token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:604800}${origin().startsWith('https://')?'; Secure':''}`;
}
