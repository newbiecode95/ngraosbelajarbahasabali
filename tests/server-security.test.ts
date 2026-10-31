import {describe,it,expect,vi,afterEach} from 'vitest';
import {isAdmin,type ActorRow} from '../src/server/actors';
import {assertOrigin,boundedFormData,jsonBody} from '../src/server/http';
import {sessionView} from '../src/server/game';
afterEach(()=>vi.unstubAllEnvs());
describe('authorization boundaries',()=>{
  it('does not grant administration to an unverified signup claiming the admin email',()=>{
    vi.stubEnv('ADMIN_EMAILS','owner@example.com');vi.stubEnv('ADMIN_USER_IDS','');
    const actor={auth_user_id:'user-one',email:'owner@example.com',emailVerified:false} as ActorRow;
    expect(isAdmin(actor)).toBe(false);expect(isAdmin({...actor,emailVerified:true})).toBe(true);
    vi.stubEnv('ADMIN_USER_IDS','user-one');expect(isAdmin(actor)).toBe(true);
    expect(isAdmin({...actor,auth_user_id:null})).toBe(false);
  });
  it('rejects a browser mutation from another origin',()=>{
    vi.stubEnv('BETTER_AUTH_URL','https://ngraos.example.com');
    expect(()=>assertOrigin(new Request('https://ngraos.example.com/api/demo',{method:'POST',headers:{Origin:'https://evil.example'}}))).toThrow();
    expect(()=>assertOrigin(new Request('https://ngraos.example.com/api/demo',{method:'POST',headers:{Origin:'https://ngraos.example.com'}}))).not.toThrow();
  });
  it('bounds streamed upload bodies even without Content-Length',async()=>{
    const request=new Request('https://ngraos.example.com/api/transcribe',{method:'POST',body:new Uint8Array(100),headers:{'Content-Type':'multipart/form-data; boundary=x'}});
    await expect(boundedFormData(request,50)).rejects.toMatchObject({status:413});
  });
  it('cancels oversized chunked JSON before buffering the remaining body',async()=>{
    const cancel=vi.fn();
    const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(32769));},cancel});
    const request=new Request('https://ngraos.example.com/api/demo',{method:'POST',body,duplex:'half'} as RequestInit & {duplex:'half'});
    await expect(jsonBody(request)).rejects.toMatchObject({status:413,code:'TOO_LARGE'});
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('enforces the JSON byte budget for multibyte input and accepts valid small bodies',async()=>{
    const request=new Request('https://ngraos.example.com/api/demo',{method:'POST',body:JSON.stringify({name:'é'.repeat(17000)})});
    await expect(jsonBody(request)).rejects.toMatchObject({status:413});
    await expect(jsonBody(new Request('https://ngraos.example.com/api/demo',{method:'POST',body:'{"name":"Tamiu"}'}))).resolves.toEqual({name:'Tamiu'});
  });
  it('never serializes choice/order answer keys to the browser',()=>{
    const row={id:'s',player_id:'p',level_id:'warung' as const,status:'quiz' as const,turns:[],completed_objectives:[],hints_used:0,quiz:[{id:'q',type:'choice' as const,prompt:{id:'Pilih',en:'Choose'},options:['A','B'],sourceId:'entry',reinforcement:true,answer:'A',variants:['a']}],result:null};
    expect(sessionView(row).quiz?.[0]).not.toHaveProperty('answer');expect(sessionView(row).quiz?.[0]).not.toHaveProperty('variants');
  });
});
