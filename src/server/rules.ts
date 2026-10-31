import type { Correction, Lesson, Localized, Turn } from '../lib/types';
export function normalize(text:string) {
  return text.normalize('NFKC').toLocaleLowerCase('id').replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}\s']/gu,' ').replace(/\s+/g,' ').trim();
}
export function phraseIn(text:string,phrase:string) {
  const t=` ${normalize(text)} `;const p=normalize(phrase);return Boolean(p && t.includes(` ${p} `));
}
export function objectiveMatches(lesson:Lesson,text:string) {
  // Evaluate the communicative act. Example phrases are not mandatory passwords.
  const value=normalize(text);
  const variants:Record<string,RegExp>={
    greet:/\b(?:om swastiastu|swastiastu|rahajeng (?:semeng|wengi|rauh|tengai|sanja))\b/u,
    thank:/\b(?:suksma|suksema)\b/u,
    farewell:/\b(?:tiang|titiang)\s+(?:[\p{L}]+\s+){0,2}pamit\b/u,
    name:/\b(?:wastan|wasta|adan|aran)\s+(?:titiang|tiang|icang)\s+\p{L}+/u,
    origin:/\b(?:titiang|tiang)\s+(?:saking|uli)\s+\p{L}+/u,
    work:/\b(?:titiang|tiang)\s+(?:mekarya|makarya)\b/u,
    price:/\b(?:aji|ajine|aji ne)\s+(?:kuda|kudang)\b/u,
    quantity:/^(?=.*\b(?:biu|poh|juwuk)\b)(?=.*\b(?:siki|kalih|telu|tetelu|pat|papat|lima|enem|pitu|kutus|sia|dasa|\d+)\b)/u,
    bargain:/\b(?:dados|prasida)\s+(?:kirang|[\p{L}\s\d]+tali)\b/u,
  };
  return lesson.objectives.filter(objective=>{
    if(objective.evidence.some(evidence=>phraseIn(text,evidence)))return true;
    const act=objective.id.split(':')[1];
    if(act==='introduce')return variants.name.test(value)||variants.origin.test(value);
    if(act==='shop')return variants.price.test(value)||variants.quantity.test(value);
    return Boolean(variants[act]?.test(value));
  }).map(objective=>objective.id);
}
export function calculateStars(turns:Turn[],hintsUsed:number,complete:boolean) {
  if(!complete) return 0;
  const assessed=turns.filter(t=>t.assessed!==false);
  if(!assessed.length) return 1;
  const correct=assessed.filter(t=>!t.corrections.some(c=>c.supported)).length;
  const ratio=correct/assessed.length;
  return ratio>=.9&&hintsUsed===0?3:ratio>=.7?2:1;
}
export function witaDate(now=new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function nextStreak(previousDate:string|null,streak:number,date:string) {
  if(previousDate===date) return streak;
  const yesterday=new Date(`${date}T00:00:00.000Z`);yesterday.setUTCDate(yesterday.getUTCDate()-1);
  return previousDate===yesterday.toISOString().slice(0,10)?streak+1:1;
}
export function answerCorrect(answer:string,expected:string,variants:string[] = []) {
  return [expected,...variants].some(value=>normalize(value)===normalize(answer));
}
export function bilingual(value:unknown):value is Localized {
  return Boolean(value && typeof value==='object' && typeof (value as Localized).id==='string' && typeof (value as Localized).en==='string');
}
export function correctionIsSupported(correction:Pick<Correction,'correct'|'type'>,entry:{bali:string;variants:string[];register:string}|undefined) {
  if(!entry || (correction.type==='politeness' && (!entry.register || entry.register==='unknown'))) return false;
  return [entry.bali,...entry.variants].some(phrase=>normalize(correction.correct)===normalize(phrase));
}
