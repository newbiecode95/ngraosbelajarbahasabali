import { createHmac } from 'node:crypto';
import { ZodError } from 'zod';
import { AppError } from './errors';
import { query } from './db';
import { authSecret, origin } from './config';
export function assertOrigin(request:Request) {
  if(['GET','HEAD','OPTIONS'].includes(request.method)) return;
  const supplied=request.headers.get('origin');
  if(!supplied) {
    if(request.headers.get('sec-fetch-site')==='cross-site') throw new AppError(403,'INVALID_ORIGIN','Permintaan tidak diizinkan.');
    return;
  }
  const allowed=new Set([new URL(origin()).origin,...(process.env.AUTH_TRUSTED_ORIGINS||'').split(',').filter(Boolean)]);
  if(!allowed.has(supplied)) throw new AppError(403,'INVALID_ORIGIN','Permintaan tidak diizinkan.');
}
export async function jsonBody(request:Request) {
  const length=Number(request.headers.get('content-length')||0);
  if(length>32_768) throw new AppError(413,'TOO_LARGE','Permintaan terlalu besar.');
  const bytes=await boundedBytes(request,32_768,'Permintaan terlalu besar.');
  const text=new TextDecoder().decode(bytes);
  try { return JSON.parse(text); } catch { throw new AppError(400,'INVALID_JSON','Format permintaan tidak valid.'); }
}
async function boundedBytes(request:Request,maximum:number,message:string) {
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();
  const chunks:Uint8Array[]=[];let total=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maximum){await reader.cancel();throw new AppError(413,'TOO_LARGE',message);}chunks.push(value);}}
  finally {reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
}
export async function boundedFormData(request:Request,maximum:number) {
  if(!request.body)throw new AppError(400,'AUDIO_REQUIRED','Rekaman belum tersedia.');
  const bytes=await boundedBytes(request,maximum,'Rekaman terlalu besar.');
  try{return await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();}
  catch{throw new AppError(400,'INVALID_UPLOAD','Format unggahan tidak valid.');}
}
export async function rateLimit(key:string,limit=20,seconds=60) {
  const result=await query(`INSERT INTO rate_limits(key,count,resets_at) VALUES($1,1,now()+($2||' seconds')::interval)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.resets_at<=now() THEN 1 ELSE rate_limits.count+1 END,
    resets_at=CASE WHEN rate_limits.resets_at<=now() THEN now()+($2||' seconds')::interval ELSE rate_limits.resets_at END RETURNING count`,[key,seconds]);
  if(Number(result.rows[0].count)>limit) throw new AppError(429,'RATE_LIMITED','Tunggu sebentar sebelum mencoba lagi.',true);
}
export function requestIdentity(request:Request) {
  const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'local';
  return createHmac('sha256',authSecret()).update(ip).digest('hex').slice(0,24);
}
export function ok(data:unknown,status=200,headers?:HeadersInit) {
  const h=new Headers(headers);h.set('Cache-Control','no-store');h.set('X-Content-Type-Options','nosniff');
  return Response.json(data,{status,headers:h});
}
export function failure(error:unknown) {
  if(error instanceof AppError) return ok({error:error.message,code:error.code,retryable:error.retryable},error.status,error.status===429?{'Retry-After':'60'}:undefined);
  if(error instanceof ZodError) return ok({error:'Periksa kembali data yang dikirim.',code:'INVALID_INPUT',retryable:false},400);
  console.error('Ngraos request failed',error instanceof Error?error.name:'UnknownError');
  return ok({error:'Layanan sedang mengalami kendala. Progres Anda tetap tersimpan.',code:'SERVICE_ERROR',retryable:true},503);
}
export async function route(request:Request,fn:()=>Promise<Response>) {
  try { assertOrigin(request); return await fn(); } catch(error) { return failure(error); }
}
