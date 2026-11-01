import 'dotenv/config';
import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { dispatch } from '../src/server/api';
import { query,getPool } from '../src/server/db';
import { createDemo,DEMO_COOKIE,findActor,playerView } from '../src/server/actors';
describe.skipIf(process.env.RUN_DB_TESTS!=='1')('named demo entry and account isolation',()=>{
  const ids:string[]=[];
  beforeAll(()=>vi.stubEnv('DEMO_ONLY','true'));
  afterAll(async()=>{vi.unstubAllEnvs();if(ids.length)await query('DELETE FROM players WHERE id=ANY($1::text[])',[ids]);await getPool().end();});
  it('persists an explicitly chosen name, even Tamiu, and keeps demos isolated',async()=>{
    const a=await createDemo(undefined,{name:'Tamiu'}),b=await createDemo(undefined,{name:'Other demo'});ids.push(a.actor.id,b.actor.id);
    expect((await playerView(a.actor)).needsName).toBe(false);
    const req=new Request('http://localhost:3000/api/player',{headers:{cookie:`${DEMO_COOKIE}=${a.token}`}});
    expect((await findActor(req))?.id).toBe(a.actor.id);
    const response=await dispatch(req),body=await response.json();expect(body.demoOnly).toBe(true);expect(body.player.name).toBe('Tamiu');expect(body.player.id).not.toBe(b.actor.id);
    const foreign=await dispatch(new Request(`http://localhost:3000/api/sessions/${randomUUID()}`,{headers:{cookie:`${DEMO_COOKIE}=${b.token}`}}));expect(foreign.status).toBe(404);
  });
  it('asks legacy unnamed demos for a name and updates the same identity without resetting progress',async()=>{
    const {actor,token}=await createDemo();ids.push(actor.id);expect((await playerView(actor)).needsName).toBe(true);
    await query('UPDATE players SET xp=100,stars=$2 WHERE id=$1',[actor.id,JSON.stringify({warung:1})]);
    const request=new Request('http://localhost:3000/api/demo',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',cookie:`${DEMO_COOKIE}=${token}`},body:JSON.stringify({name:'Ayu',locale:'id'})});
    const response=await dispatch(request);expect(response.status).toBe(200);const {player}=await response.json();
    expect(player).toMatchObject({id:actor.id,name:'Ayu',needsName:false,xp:100,stars:{warung:1}});
  });
});
