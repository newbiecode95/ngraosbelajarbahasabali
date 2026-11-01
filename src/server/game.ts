import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import type { Correction, CorpusEntry, GameSession, LevelId, QuizQuestion, SessionResult, Turn } from '../lib/types';
import { query, transaction } from './db';
import { AppError, requireValue } from './errors';
import { eligibleEntries, lessonById, levelOrder, retrieve } from './content';
import { generateQuiz, repairReply, roleplay, type QuizDraft } from './openrouter';
import { publicTurn, replyNeedsRepair } from '../lib/learning-text';
import { answerCorrect, calculateStars, correctionIsSupported, nextStreak, normalize, objectiveMatches, phraseIn, witaDate } from './rules';
import { type ActorRow, playerView } from './actors';
export interface PrivateQuestion extends QuizQuestion {answer:string;variants:string[]}
export interface SessionRow {id:string;player_id:string;level_id:LevelId;status:GameSession['status'];turns:Turn[];completed_objectives:string[];hints_used:number;quiz:PrivateQuestion[]|null;result:SessionResult|null}
export function sessionView(row:SessionRow):GameSession {
  return {id:row.id,levelId:row.level_id,status:row.status,turns:row.turns.map(publicTurn),completedObjectives:row.completed_objectives,hintsUsed:row.hints_used,quiz:row.quiz?.map(({answer,variants,...q})=>q),result:row.result||undefined};
}
export async function ownedSession(id:string,playerId:string,client?:PoolClient,lock=false):Promise<SessionRow> {
  const sql=`SELECT * FROM game_sessions WHERE id=$1 AND player_id=$2${lock?' FOR UPDATE':''}`;
  const result=client?await client.query<SessionRow>(sql,[id,playerId]):await query<SessionRow>(sql,[id,playerId]);
  return requireValue(result.rows[0],'SESSION_NOT_FOUND');
}
export function levelIsUnlocked(levelId:LevelId,stars:ActorRow['stars']) {
  const index=levelOrder.indexOf(levelId);return index===0 || (stars[levelOrder[index-1]]||0)>=1;
}
export async function startSession(actor:ActorRow,levelId:LevelId) {
  lessonById(levelId);
  return transaction(async client=>{
    const current=requireValue((await client.query<ActorRow>('SELECT * FROM players WHERE id=$1 FOR UPDATE',[actor.id])).rows[0]);
    if(!levelIsUnlocked(levelId,current.stars)) throw new AppError(403,'LEVEL_LOCKED','Selesaikan lokasi sebelumnya untuk membuka tempat ini.');
    const existing=await client.query<SessionRow>('SELECT * FROM game_sessions WHERE player_id=$1 AND level_id=$2 AND status<>\'completed\' ORDER BY updated_at DESC LIMIT 1',[actor.id,levelId]);
    if(existing.rows[0])return sessionView(existing.rows[0]);
    const row=(await client.query<SessionRow>('INSERT INTO game_sessions(id,player_id,level_id) VALUES($1,$2,$3) RETURNING *',[randomUUID(),actor.id,levelId])).rows[0];
    return sessionView(row);
  });
}
export const turnInput=z.object({id:z.string().uuid(),text:z.string().trim().min(1).max(1000),rawTranscript:z.string().max(3000).optional()});
export async function addTurn(actor:ActorRow,sessionId:string,input:z.infer<typeof turnInput>) {
  return transaction(async client=>{
    const session=await ownedSession(sessionId,actor.id,client,true);
    const prior=session.turns.find(t=>t.id===input.id);
    if(prior) {
      if(prior.playerText!==input.text) throw new AppError(409,'IDEMPOTENCY_CONFLICT','Giliran ini sudah digunakan. Silakan kirim sebagai giliran baru.');
      return {session:sessionView(session),turn:publicTurn(prior)};
    }
    if(session.status!=='active')throw new AppError(409,'SESSION_NOT_ACTIVE','Percakapan sudah selesai. Lanjutkan kuis atau mulai sesi baru.');
    if(session.turns.length>=30)throw new AppError(422,'TURN_LIMIT','Sesi sudah mencapai batas giliran. Gunakan petunjuk untuk menyelesaikan tujuan.');
    const lesson=lessonById(session.level_id);const entries=await retrieve(input.text,session.level_id,actor.id,client);
    const output=await roleplay({lesson,text:input.text,turns:session.turns,entries,completedObjectives:session.completed_objectives,playerId:actor.id,db:client});
    const entryMap=new Map(entries.map(entry=>[entry.id,entry]));
    const corrections:Correction[]=output.corrections.filter(c=>normalize(c.said)&&normalize(input.text).includes(normalize(c.said))).map(c=>({
      ...c,supported:correctionIsSupported(c,entryMap.get(c.sourceId)),
    }));
    // Author-written evidence is the authority. Model-proposed objectives never grant completion alone.
    const playerUtterances=[input.text,...session.turns.map(turn=>turn.playerText)];
    const objectiveIds=lesson.objectives.map(o=>o.id).filter(id=>!session.completed_objectives.includes(id)&&output.objectiveEvidence.some(e=>e.objectiveId===id&&normalize(e.quote)&&playerUtterances.some(text=>phraseIn(text,e.quote))&&objectiveMatches(lesson,e.quote).includes(id)));
    const assessed=objectiveIds.length>0||corrections.some(c=>c.supported)||entries.some(e=>phraseIn(input.text,e.bali));
    const turn:Turn={id:input.id,playerText:input.text,rawTranscript:input.rawTranscript,reply:output.reply,translation:output.translation,corrections,objectiveIds,assessed,createdAt:new Date().toISOString()};
    const completed=[...new Set([...session.completed_objectives,...objectiveIds])];
    for(let i=0;i<corrections.length;i++)if(corrections[i].supported)await client.query('INSERT INTO mistakes(id,player_id,session_id,turn_id,correction,source_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[`${input.id}:${i}`,actor.id,session.id,input.id,JSON.stringify(corrections[i]),corrections[i].sourceId]);
    const result=await client.query<SessionRow>('UPDATE game_sessions SET turns=$2,completed_objectives=$3,updated_at=now() WHERE id=$1 RETURNING *',[session.id,JSON.stringify([...session.turns,turn]),JSON.stringify(completed)]);
    return {session:sessionView(result.rows[0]),turn};
  });
}
export async function repairTurnReply(actor:ActorRow,sessionId:string,turnId:string) {
  return transaction(async client=>{
    const session=await ownedSession(sessionId,actor.id,client,true);
    const turn=requireValue(session.turns.find(item=>item.id===turnId),'TURN_NOT_FOUND');
    if(!replyNeedsRepair(turn))return {session:sessionView(session),turn:publicTurn(turn)};
    const repaired=await repairReply({lesson:lessonById(session.level_id),turn,playerId:actor.id,db:client});
    const updated={...turn,...repaired};
    delete updated.replyUnavailable;
    // Repair presentation only. Never reassess words, change mission evidence,
    // consume a hint, or issue another reward for an existing turn.
    const turns=session.turns.map(item=>item.id===turnId?updated:item);
    const row=(await client.query<SessionRow>('UPDATE game_sessions SET turns=$2 WHERE id=$1 RETURNING *',[session.id,JSON.stringify(turns)])).rows[0];
    return {session:sessionView(row),turn:publicTurn(updated)};
  });
}
export async function useHint(actor:ActorRow,sessionId:string) {
  return transaction(async client=>{
    const session=await ownedSession(sessionId,actor.id,client,true);const lesson=lessonById(session.level_id);
    if(session.level_id==='boss')throw new AppError(400,'NO_BOSS_HINTS','Tantangan ini tidak memakai petunjuk jawaban.');
    if(session.status!=='active')throw new AppError(409,'SESSION_NOT_ACTIVE','Percakapan sudah selesai.');
    const next=lesson.objectives.find(o=>!session.completed_objectives.includes(o.id));
    if(!next) return {hint:actor.locale==='en'?'Your mission is complete. Continue to the quiz.':'Misi sudah selesai. Lanjutkan ke kuis.',session:sessionView(session)};
    const result=await client.query<SessionRow>('UPDATE game_sessions SET hints_used=hints_used+1,updated_at=now() WHERE id=$1 RETURNING *',[session.id]);
    return {hint:`${next.title[actor.locale]}: ${next.evidence[0]}`,session:sessionView(result.rows[0])};
  });
}
function shuffle<T>(values:T[]) {
  const output=[...values];for(let i=output.length-1;i>0;i--){const j=randomInt(i+1);[output[i],output[j]]=[output[j],output[i]];}return output;
}
export function shuffleWords(text:string) {
  const words=shuffle(text.split(/\s+/));
  if(words.join(' ')===text && new Set(words).size>1)words.push(words.shift()!);
  return words;
}
export function validateQuestions(drafts:QuizDraft[],entries:CorpusEntry[],mistakes:{id:string;correction:{correct:string;sourceId:string}}[]):PrivateQuestion[] {
  if(drafts.length!==5||new Set(drafts.map(q=>q.type)).size!==3)throw new AppError(502,'INVALID_QUIZ','Kuis belum dapat diperiksa. Silakan coba lagi.',true);
  const entryMap=new Map(entries.map(e=>[e.id,e]));const mistakeMap=new Map(mistakes.map(m=>[m.id,m]));
  if(mistakes.length && drafts.filter(q=>q.mistakeId && mistakeMap.has(q.mistakeId)).length<4)throw new AppError(502,'INVALID_QUIZ','Kuis belum sesuai dengan latihan Anda. Silakan coba lagi.',true);
  return drafts.map(draft=>{
    const entry=entryMap.get(draft.sourceId);const mistake=draft.mistakeId?mistakeMap.get(draft.mistakeId):undefined;
    if(!entry || (draft.mistakeId && (!mistake||mistake.correction.sourceId!==draft.sourceId)))throw new AppError(502,'INVALID_QUIZ_SOURCE','Sumber kuis belum dapat diperiksa. Silakan coba lagi.',true);
    const acceptable=[entry.bali,...entry.variants,...(mistake?[mistake.correction.correct]:[])];
    if(!acceptable.some(a=>normalize(a)===normalize(draft.answer)))throw new AppError(502,'INVALID_QUIZ_ANSWER','Jawaban kuis belum dapat diperiksa. Silakan coba lagi.',true);
    if(draft.type!=='repeat'&&(phraseIn(draft.prompt.id,draft.answer)||phraseIn(draft.prompt.en,draft.answer)))throw new AppError(502,'INVALID_QUIZ_ANSWER','Petunjuk kuis perlu diperbaiki. Silakan coba lagi.',true);
    if(draft.type==='choice'&&(draft.options.length!==4||new Set(draft.options.map(normalize)).size!==4||draft.options.filter(a=>normalize(a)===normalize(draft.answer)).length!==1))throw new AppError(502,'INVALID_QUIZ_CHOICES','Pilihan kuis belum dapat diperiksa. Silakan coba lagi.',true);
    if(draft.type==='order'&&draft.answer.trim().split(/\s+/).length<2)throw new AppError(502,'INVALID_QUIZ_ORDER','Kalimat kuis belum dapat diperiksa. Silakan coba lagi.',true);
    return {id:randomUUID(),type:draft.type,prompt:draft.prompt,sourceId:draft.sourceId,mistakeId:draft.mistakeId||undefined,reinforcement:!mistake,
      ...(draft.type==='choice'?{options:shuffle(draft.options)}:{}),
      ...(draft.type==='order'?{words:shuffleWords(draft.answer)}:{}),
      ...(draft.type==='repeat'?{target:draft.answer}:{}),answer:draft.answer,variants:acceptable,
    };
  });
}
// A checked, source-derived exercise remains available if generated quiz JSON
// fails validation twice. No learner error is invented and no answer is leaked.
export function buildPracticeQuiz(entries:CorpusEntry[],mistakes:{id:string;correction:{correct:string;sourceId:string}}[]) {
  const usable=entries.filter(e=>!phraseIn(e.indonesia,e.bali)&&!phraseIn(e.english,e.bali));
  const order=usable.find(e=>e.bali.trim().split(/\s+/).length>=2);
  if(usable.length<4||!order)throw new AppError(503,'CONTENT_NOT_READY','Latihan sedang disiapkan. Coba lagi sebentar.',true);
  const drafts:QuizDraft[]=Array.from({length:5},(_,index)=>{
    const mistake=mistakes.length&&index<4?mistakes[index%mistakes.length]:undefined;
    const entry=(mistake?entries.find(e=>e.id===mistake.correction.sourceId):index===4?order:usable[index%usable.length])!;
    const answer=mistake?.correction.correct||entry.bali;
    const type=index===4?'order':index%2===0?'choice':'repeat';
    return {type,sourceId:entry.id,mistakeId:mistake?.id||null,answer,
      prompt:type==='repeat'?{id:'Dengarkan lalu ulangi kalimatnya.',en:'Listen, then repeat the phrase.'}:type==='order'?{id:`Susun ungkapan dengan arti: ${entry.indonesia}`,en:`Arrange the phrase meaning: ${entry.english}`}:{id:`Pilih ungkapan dengan arti: ${entry.indonesia}`,en:`Choose the phrase meaning: ${entry.english}`},
      options:type==='choice'?[answer,...usable.filter(e=>normalize(e.bali)!==normalize(answer)).map(e=>e.bali).filter((v,i,a)=>a.findIndex(x=>normalize(x)===normalize(v))===i).slice(0,3)]:[],
    };
  });
  return validateQuestions(drafts,entries,mistakes);
}
export async function prepareQuiz(actor:ActorRow,sessionId:string) {
  return transaction(async client=>{
    const session=await ownedSession(sessionId,actor.id,client,true);
    if(session.quiz)return sessionView(session);
    const lesson=lessonById(session.level_id);
    if(!lesson.objectives.every(o=>session.completed_objectives.includes(o.id)))throw new AppError(409,'MISSION_INCOMPLETE','Selesaikan semua tujuan percakapan sebelum kuis.');
    const entries=await eligibleEntries(session.level_id,client);
    const mistakeRows=await client.query<{id:string;correction:Correction}>('SELECT id,correction FROM mistakes WHERE session_id=$1 ORDER BY created_at',[session.id]);
    // Prompt contains only the relevant phrases and error sources, never profile data.
    const requiredSources=new Set(mistakeRows.rows.map(m=>m.correction.sourceId));
    const selected=[...new Map([...entries.filter(e=>requiredSources.has(e.id)),...entries.filter(e=>lesson.phrases.includes(e.id)),...entries.filter(e=>e.bali.split(/\s+/).length>1)].map(e=>[e.id,e])).values()].slice(0,60);
    let quiz:PrivateQuestion[]|undefined;
    for(let attempt=0;attempt<2;attempt++) {
      try {const output=await generateQuiz({lesson,entries:selected,mistakes:mistakeRows.rows,playerId:actor.id,db:client});quiz=validateQuestions(output.questions,selected,mistakeRows.rows);break;}
      catch(error){if(!(error instanceof AppError)||!['AI_INVALID_OUTPUT','INVALID_QUIZ','INVALID_QUIZ_SOURCE','INVALID_QUIZ_ANSWER','INVALID_QUIZ_CHOICES','INVALID_QUIZ_ORDER'].includes(error.code))throw error;if(attempt===1)quiz=buildPracticeQuiz(selected,mistakeRows.rows);}
    }
    const result=await client.query<SessionRow>("UPDATE game_sessions SET status='quiz',quiz=$2,updated_at=now() WHERE id=$1 RETURNING *",[session.id,JSON.stringify(quiz)]);
    return sessionView(result.rows[0]);
  });
}
export async function completeSession(actor:ActorRow,sessionId:string,answers:Record<string,string>) {
  return transaction(async client=>{
    // Lock actor before session for serial rewards across two sessions/tabs.
    const current=requireValue((await client.query<ActorRow>('SELECT * FROM players WHERE id=$1 FOR UPDATE',[actor.id])).rows[0]);
    const session=await ownedSession(sessionId,actor.id,client,true);
    if(session.result)return {session:sessionView(session),result:session.result,player:await playerView({...current,email:actor.email,emailVerified:actor.emailVerified},client)};
    if(session.status!=='quiz'||!session.quiz)throw new AppError(409,'QUIZ_REQUIRED','Selesaikan kuis sebelum menerima hadiah.');
    if(session.quiz.some(q=>!answers[q.id]?.trim())||Object.keys(answers).some(id=>!session.quiz!.some(q=>q.id===id)))throw new AppError(400,'QUIZ_INCOMPLETE','Jawab semua soal sebelum melanjutkan.');
    const lesson=lessonById(session.level_id);const score=session.quiz.filter(q=>answerCorrect(answers[q.id],q.answer,q.type==='repeat'?q.variants:[])).length;
    const stars=calculateStars(session.turns,session.hints_used,lesson.objectives.every(o=>session.completed_objectives.includes(o.id)));
    if(!stars)throw new AppError(409,'MISSION_INCOMPLETE','Misi belum selesai.');
    const firstClear=!current.stars[session.level_id];
    const xp=session.turns.filter(t=>t.assessed!==false&&!t.corrections.some(c=>c.supported)).length*10+score*20+(firstClear?50:0);
    const newStars={...current.stars,[session.level_id]:Math.max(stars,current.stars[session.level_id]||0)};
    const albums=[...new Set([...current.albums,session.level_id])];
    const next=levelOrder[levelOrder.indexOf(session.level_id)+1];
    const result:SessionResult={stars,xp,quizScore:score,quizTotal:session.quiz.length,newAlbum:!current.albums.includes(session.level_id),...(firstClear&&next?{unlockedLevel:next}:{})};
    const event=await client.query('INSERT INTO reward_events(id,player_id,session_id,xp) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id',[`complete:${session.id}`,actor.id,session.id,xp]);
    if(!event.rows.length)throw new AppError(409,'REWARD_ALREADY_RECORDED','Hadiah sudah tercatat. Muat ulang progres Anda.');
    const date=witaDate();const streak=nextStreak(current.last_active_date,current.streak,date);
    const updated=(await client.query<ActorRow>('UPDATE players SET xp=xp+$2,stars=$3,albums=$4,streak=$5,last_active_date=$6 WHERE id=$1 RETURNING *',[actor.id,xp,JSON.stringify(newStars),JSON.stringify(albums),streak,date])).rows[0];
    const saved=(await client.query<SessionRow>("UPDATE game_sessions SET status='completed',result=$2,updated_at=now() WHERE id=$1 RETURNING *",[session.id,JSON.stringify(result)])).rows[0];
    return {session:sessionView(saved),result,player:await playerView({...updated,email:actor.email,emailVerified:actor.emailVerified},client)};
  });
}
