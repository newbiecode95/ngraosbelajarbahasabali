import 'dotenv/config';
import { afterAll,beforeAll,describe,it,expect,vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { getAuth } from '../src/server/auth';
import { query,getPool } from '../src/server/db';
import { findActor,isAdmin } from '../src/server/actors';
const enabled=process.env.RUN_DB_TESTS==='1';
describe.skipIf(!enabled)('Better Auth PostgreSQL integration',()=>{
  let userId:string|undefined;
  beforeAll(()=>vi.stubEnv('DEMO_ONLY','false'));
  afterAll(async()=>{vi.unstubAllEnvs();if(userId)await query('DELETE FROM "user" WHERE id=$1',[userId]);await getPool().end();});
  it('signs up, authenticates a cookie, and isolates account data from demo',async()=>{
    const random=randomBytes(12).toString('hex');
    const response=await getAuth().api.signUpEmail({body:{name:'Auth integration',email:`test-${random}@ngraos.invalid`,password:randomBytes(24).toString('base64url')},asResponse:true});
    expect(response.status).toBe(200);
    const body=await response.json();userId=body.user.id;
    const cookies=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
    expect(cookies).toContain('session_token');
    const session=await getAuth().api.getSession({headers:new Headers({cookie:cookies})});
    expect(session?.user.id).toBe(userId);
    const actor=await findActor(new Request('http://localhost:3000/api/player',{headers:{cookie:cookies}}));
    expect(actor?.auth_user_id).toBe(userId);expect(actor?.demo_token_hash).toBe(null);expect(isAdmin(actor!)).toBe(false);
    const anonymous=await findActor(new Request('http://localhost:3000/api/player'));expect(anonymous).toBe(null);
  },15000);
});
