import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { aiReady, demoOnly, models } from './config';
import { getDb, query, transaction } from './db';
import { corpusEntries } from './schema';
import { cookieValue, createDemo, demoCookie, DEMO_COOKIE, findActor, playerView, requireActor, requireAdmin, type ActorRow } from './actors';
import { boundedFormData, jsonBody, ok, rateLimit, requestIdentity, route } from './http';
import { AppError, requireValue } from './errors';
import { addTurn, checkQuizAnswer, completeSession, loadSession, ownedSession, prepareQuiz, repairTurnReply, startSession, turnInput, useHint } from './game';
import { eligibleEntries, lessonById } from './content';
import { cachedSpeech, normalizeRecording } from './audio';
import { transcribe } from './openrouter';
import type { CorpusEntry, LevelId } from '../lib/types';
const levelSchema=z.enum(['warung','kos','pasar','boss']);
const idSchema=z.string().uuid();
async function handle(request:Request) {
  const url=new URL(request.url);const path=url.pathname.replace(/^\/api\/?/,'').replace(/\/$/,'');const method=request.method;
  if(path==='health' && method==='GET') {
    const counts=await query('SELECT (SELECT count(*)::int FROM corpus_entries WHERE enabled=true) AS entries');
    return ok({status:'ok',database:'ready',aiReady:aiReady(),corpusEntries:Number(counts.rows[0].entries),version:'0.1.0'});
  }
  if(path==='player' && method==='GET') {
    const actor=await findActor(request);return ok({player:actor?await playerView(actor):null,aiReady:aiReady(),demoOnly:demoOnly()});
  }
  if(path==='demo' && (method==='POST'||method==='DELETE')) {
    await rateLimit(`demo:${requestIdentity(request)}`,12,3600);
    const profile=method==='POST'&&request.body?z.object({name:z.string().trim().min(1).max(60).optional(),locale:z.enum(['id','en']).optional()}).parse(await jsonBody(request)):{};
    const previous=cookieValue(request,DEMO_COOKIE);
    if(method==='POST'&&previous) {const actor=await findActor(request);if(actor&&!actor.auth_user_id){const updated=(await query<ActorRow>('UPDATE players SET name=COALESCE($2,name),locale=COALESCE($3,locale),demo_name_set=demo_name_set OR ($2::text IS NOT NULL) WHERE id=$1 RETURNING *',[actor.id,profile.name||null,profile.locale||null])).rows[0];return ok({player:await playerView(updated)});}}
    const {actor,token}=await createDemo(previous,profile);return ok({player:await playerView(actor)},201,{'Set-Cookie':demoCookie(token)});
  }
  if(path==='demo/exit'&&method==='POST')return ok({ok:true},200,{'Set-Cookie':demoCookie('',true)});
  if(path==='player' && method==='PATCH') {
    const actor=await requireActor(request);const body=z.object({name:z.string().trim().min(1).max(60).optional(),locale:z.enum(['id','en']).optional()}).parse(await jsonBody(request));
    const updated=(await query<ActorRow>('UPDATE players SET name=COALESCE($2,name),locale=COALESCE($3,locale),demo_name_set=demo_name_set OR ($2::text IS NOT NULL) WHERE id=$1 RETURNING *',[actor.id,body.name||null,body.locale||null])).rows[0];
    return ok({player:await playerView({...updated,email:actor.email,emailVerified:actor.emailVerified})});
  }
  if(path==='player' && method==='DELETE') {
    const actor=await requireActor(request);
    await transaction(async client=>{if(actor.auth_user_id)await client.query('DELETE FROM "user" WHERE id=$1',[actor.auth_user_id]);else await client.query('DELETE FROM players WHERE id=$1',[actor.id]);});
    return ok({ok:true},200,{'Set-Cookie':demoCookie('',true)});
  }
  if(path==='sessions' && method==='POST') {
    const actor=await requireActor(request);await rateLimit(`start:${actor.id}`,30,3600);
    const {levelId}=z.object({levelId:levelSchema}).parse(await jsonBody(request));
    return ok({session:await startSession(actor,levelId)},201);
  }
  const sessionMatch=/^sessions\/([^/]+)(?:\/(turns|hint|quiz|complete|repair-reply|answer))?$/.exec(path);
  if(sessionMatch) {
    const actor=await requireActor(request);const id=idSchema.parse(sessionMatch[1]);const action=sessionMatch[2];
    if(!action&&method==='GET')return ok({session:await loadSession(actor,id)});
    if(method!=='POST')throw new AppError(405,'METHOD_NOT_ALLOWED','Metode tidak tersedia.');
    if(action==='turns'){const body=turnInput.parse(await jsonBody(request));await rateLimit(`turn:${actor.id}`,20);return ok(await addTurn(actor,id,body));}
    if(action==='repair-reply'){const body=z.object({turnId:idSchema}).parse(await jsonBody(request));await rateLimit(`repair:${actor.id}`,8);return ok(await repairTurnReply(actor,id,body.turnId));}
    if(action==='hint'){const body=z.object({objectiveId:z.string().max(100).optional()}).parse(await jsonBody(request));await rateLimit(`hint:${actor.id}`,15);return ok(await useHint(actor,id,body.objectiveId));}
    if(action==='answer'){const body=z.object({questionId:z.string().min(1).max(200),answer:z.string().trim().min(1).max(1000)}).parse(await jsonBody(request));await rateLimit(`answer:${actor.id}`,30);return ok(await checkQuizAnswer(actor,id,body.questionId,body.answer));}
    if(action==='quiz'){await rateLimit(`quiz:${actor.id}`,8);return ok({session:await prepareQuiz(actor,id)});}
    if(action==='complete'){const body=z.object({answers:z.record(z.string(),z.string().max(1000))}).parse(await jsonBody(request));return ok(await completeSession(actor,id,body.answers));}
  }
  if(path==='transcribe'&&method==='POST') {
    const actor=await requireActor(request);await rateLimit(`transcribe:${actor.id}`,12);
    const length=Number(request.headers.get('content-length')||0);if(length>9*1024*1024)throw new AppError(413,'TOO_LARGE','Rekaman terlalu besar.');
    const form=await boundedFormData(request,9*1024*1024);const file=form.get('audio');if(!(file instanceof File))throw new AppError(400,'AUDIO_REQUIRED','Rekaman belum tersedia.');
    const levelId=levelSchema.parse(form.get('levelId'));
    const wav=await normalizeRecording(file);return ok(await transcribe(wav,lessonById(levelId),actor.id));
  }
  if(path==='speech'&&method==='POST') {
    const actor=await requireActor(request);await rateLimit(`speech:${actor.id}`,25);
    const body=z.object({sessionId:z.string().uuid().optional(),turnId:z.string().uuid().optional(),levelId:levelSchema.optional(),phraseId:z.string().max(200).optional()}).parse(await jsonBody(request));
    let text='';let levelId:LevelId;let safeToCache=true;
    if(body.sessionId) {
      const session=await ownedSession(body.sessionId,actor.id);levelId=session.level_id;
      if(body.turnId) {text=requireValue(session.turns.find(t=>t.id===body.turnId),'TURN_NOT_FOUND').reply;safeToCache=false;}
      else if(body.phraseId==='opening')text=lessonById(levelId).opening;
      else {
        const question=session.quiz?.find(q=>q.id===body.phraseId);
        if(question && (question.type==='repeat'||session.quiz_answers?.[question.id])) {text=question.answer;safeToCache=!question.mistakeId;}
      }
    } else if(body.levelId) {levelId=body.levelId;if(body.phraseId==='opening')text=lessonById(levelId).opening;}
    else throw new AppError(400,'SPEECH_CONTEXT_REQUIRED','Pilih percakapan sebelum memutar suara.');
    if(!text&&body.phraseId) {
      const lesson=lessonById(levelId);const entries=await eligibleEntries(levelId);
      const entry=entries.find(e=>e.id===body.phraseId&&lesson.phrases.includes(e.id));if(entry)text=entry.bali;
    }
    if(!text)throw new AppError(404,'SPEECH_NOT_FOUND','Audio ini belum tersedia.');
    const audio=await cachedSpeech(text,lessonById(levelId).voice,actor.id,safeToCache);
    return new Response(new Uint8Array(audio),{headers:{'Content-Type':'audio/wav','Content-Length':String(audio.length),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(path==='reports'&&method==='POST') {
    const actor=await requireActor(request);await rateLimit(`report:${actor.id}`,10,3600);
    const body=z.object({sessionId:z.string().uuid(),turnId:z.string().uuid().optional(),message:z.string().trim().min(3).max(2000)}).parse(await jsonBody(request));
    const session=await ownedSession(body.sessionId,actor.id);if(body.turnId&&!session.turns.some(t=>t.id===body.turnId))throw new AppError(404,'TURN_NOT_FOUND','Giliran tidak ditemukan.');
    await query('INSERT INTO reports(id,player_id,session_id,turn_id,message) VALUES($1,$2,$3,$4,$5)',[randomUUID(),actor.id,body.sessionId,body.turnId||null,body.message]);return ok({ok:true},201);
  }
  if(path==='admin'&&method==='GET') {
    await requireAdmin(request);
    const [totals,usage,reports]=await Promise.all([
      query(`SELECT (SELECT count(*)::int FROM players) AS players,(SELECT count(*)::int FROM game_sessions WHERE status='completed') AS completed_sessions,(SELECT count(*)::int FROM corpus_entries) AS corpus_entries,(SELECT count(*)::int FROM reports WHERE resolved=false) AS open_reports`),
      query(`SELECT stage,model,provider,count(*)::int AS requests,sum(input_tokens)::bigint AS input_tokens,sum(output_tokens)::bigint AS output_tokens,round(avg(latency_ms))::int AS avg_latency_ms,sum(COALESCE((metadata->>'costUsd')::numeric,0))::float AS cost_usd FROM ai_usage WHERE created_at>now()-interval '30 days' GROUP BY stage,model,provider ORDER BY requests DESC`),
      query('SELECT id,session_id,turn_id,message,resolved,created_at FROM reports ORDER BY created_at DESC LIMIT 30'),
    ]);
    return ok({totals:totals.rows[0],usage:usage.rows,reports:reports.rows,models:models(),aiReady:aiReady(),modelConfiguration:'environment',costs:'Reported costs only; audio requests may not include cost metadata.'});
  }
  if(path==='admin/content'&&method==='GET') {
    await requireAdmin(request);const result=await getDb().select().from(corpusEntries);return ok({entries:result.map(r=>({...r.entry,enabled:r.enabled,embedded:Boolean(r.embedding),embeddingModel:r.embeddingModel}))});
  }
  if(path==='admin/content'&&method==='PATCH') {
    await requireAdmin(request);const body=z.object({id:z.string().max(200),enabled:z.boolean().optional(),status:z.enum(['draft','sourced']).optional()}).parse(await jsonBody(request));
    const result=await query<{entry:CorpusEntry;enabled:boolean}>(`UPDATE corpus_entries SET enabled=COALESCE($2,enabled),entry=CASE WHEN $3::text IS NULL THEN entry ELSE jsonb_set(entry,'{status}',to_jsonb($3::text)) END,updated_at=now() WHERE id=$1 RETURNING entry,enabled`,[body.id,body.enabled??null,body.status||null]);
    return ok(requireValue(result.rows[0]));
  }
  if(path==='admin/reports'&&method==='PATCH') {
    await requireAdmin(request);const body=z.object({id:z.string().uuid(),resolved:z.boolean()}).parse(await jsonBody(request));await query('UPDATE reports SET resolved=$2 WHERE id=$1',[body.id,body.resolved]);return ok({ok:true});
  }
  throw new AppError(404,'NOT_FOUND','Halaman API tidak ditemukan.');
}
export async function dispatch(request:Request) {return route(request,()=>handle(request));}
