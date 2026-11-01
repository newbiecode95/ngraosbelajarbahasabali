import { afterEach,expect,it,vi } from 'vitest';
import { demoOnly } from '../src/server/config';
import { POST } from '../src/app/api/auth/[...all]/route';
afterEach(()=>vi.unstubAllEnvs());
it('defaults to demo and can restore account mode explicitly',()=>{
  vi.stubEnv('DEMO_ONLY','');expect(demoOnly()).toBe(true);
  vi.stubEnv('DEMO_ONLY','false');expect(demoOnly()).toBe(false);
});
it('blocks public credential login before accessing the auth service in demo mode',async()=>{
  vi.stubEnv('DEMO_ONLY','true');
  const response=await POST(new Request('http://localhost:3000/api/auth/sign-in/email',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({email:'fixture@ngraos.invalid',password:'not-a-real-password'})}));
  expect(response.status).toBe(403);expect(await response.json()).toMatchObject({code:'DEMO_ONLY'});
});
