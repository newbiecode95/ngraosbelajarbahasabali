import type { Correction, Lesson, Localized, Turn } from '../lib/types';
export function normalize(text:string) {
  return text.normalize('NFKC').toLocaleLowerCase('id').replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}\s']/gu,' ').replace(/\s+/g,' ').trim();
}
export function phraseIn(text:string,phrase:string) {
  const t=` ${normalize(text)} `;const p=normalize(phrase);return Boolean(p && t.includes(` ${p} `));
}
export function playerActClauses(text:string) {
  // Asking about a phrase or requesting a score is not performing the mission.
  if(/\b(?:mark|complete|unlock|grant|award|set|tandai|centang|selesaikan|anggap)\b.{0,65}\b(?:objectives?|goals?|missions?|misi|targets?|levels?)\b|\b(?:apa arti|artinya apa|what does|how (?:do|can) (?:i|you) say|translate|terjemahkan|bagaimana (?:cara )?(?:bilang|mengucapkan))\b/iu.test(text))return [];
  return text.split(/[.!?;,\n]+/u).map(normalize).filter(clause=>clause&&!/\b(?:tidak|nggak|gak|belum|sing|nenten)\s+(?:jadi\s+)?(?:mau|ingin|beli|pesan|nunas|meli)\b|\b(?:don'?t|do not)\s+(?:want|buy|order)\b|\bbukan\s+(?:satu|dua|tiga|\d+)\b/u.test(clause));
}
export function objectiveMatches(lesson:Lesson,text:string,context:{previousReply?:string;history?:string}={}) {
  // Clear acts are recognized independently of the model. Semantic evidence
  // handles other natural forms in resolveObjectives, without a phrase password.
  const clauses=playerActClauses(text);
  if(!clauses.length)return [];
  const variants:Record<string,RegExp>={
    greet:/\b(?:om swastiastu|swastiastu|rahajeng (?:semeng|wengi|rauh|tengai|sanja)|selamat (?:pagi|siang|sore|malam)|halo|hello|good (?:morning|afternoon|evening))\b/u,
    thank:/\b(?:suksma|suksema|terima kasih|makasih|thank you|thanks)\b/u,
    farewell:/\b(?:(?:tiang|titiang)\s+(?:[\p{L}]+\s+){0,2}pamit|(?:saya|aku) (?:mau )?(?:pamit|pulang)|sampai jumpa|goodbye|i (?:am leaving|have to go))\b/u,
    name:/\b(?:(?:wastan|wasta|adan|aran)\s+(?:titiang|tiang|icang)|nama (?:saya|aku)|(?:saya|aku) bernama|my name is|call me)\s+\p{L}+/u,
    origin:/\b(?:(?:titiang|tiang)\s+(?:saking|uli)|(?:saya|aku)\s+(?:berasal )?dari|i (?:am|'m) from)\s+\p{L}+/u,
    work:/\b(?:(?:titiang|tiang)\s+(?:mekarya|makarya)|(?:saya|aku)\s+(?:bekerja|kerja)|i work)\b/u,
    price:/\b(?:aji|ajine|aji ne)\b.{0,35}\b(?:kuda|kudang)\b|\b(?:kuda|kudang)\b.{0,35}\b(?:aji|ajine|aji ne)\b|\bberapa\b.{0,35}\b(?:harga|harganya|ini|pisang|mangga|jeruk|kelapa)\b|\b(?:harga|harganya)\b.{0,35}\bberapa\b|\b(?:how much|what is the price)\b/u,
    bargain:/\b(?:dados|prasida)\s+(?:kirang|[\p{L}\s\d]+tali)\b|\bkirang\b.{0,20}\b(?:dados|prasida|malih)\b|\b(?:boleh|bisa)\b.{0,20}\b(?:kurang|murah|diskon|ribu|rupiah|rb)\b|\b(?:lebih murah|discount|cheaper|lower the price)\b/u,
  };
  const fruit=/\b(?:biu(?:n[eé])?|poh(?:n[eé])?|juwuk(?:n[eé])?|nyuh(?:n[eé])?|pisang|mangga|jeruk|kelapa|bananas?|mango(?:es)?|oranges?|coconuts?)(?=$|[^\p{L}\p{N}])/u;
  const number=/\b(?:siki|kalih|telu|tetelu|pat|papat|lima|enem|pitu|kutus|sia|dasa|satu|sebuah|dua|tiga|empat|enam|tujuh|delapan|sembilan|sepuluh|one|two|three|four|five|six|seven|eight|nine|ten|[1-9]\d*)\b/u;
  const previous=normalize(context.previousReply||'');
  const quantityQuestion=/\b(?:how many|berapa (?:banyak|buah|jumlah|pisang|mangga|jeruk)|jumlah|nunas kuda|kuda (?:biu|poh|juwuk))\b|\b(?:mau|ingin|beli|nunas)\b.{0,30}\bberapa\b/u.test(previous);
  const count=new RegExp(`${number.source}(?!\\s*(?:tali|ribu|rupiah|rb|thousand|dollars?)\\b)`,'u');
  const money=new RegExp(`${number.source}(?:\\s+(?:belas|puluh|ratus|hundred|${number.source}))*\\s*(?:tali|ribu|rupiah|rb|thousand|dollars?)\\b`,'gu');
  const quantity=(value:string)=>{
    const withoutMoney=value.replace(money,' ');
    return (fruit.test(withoutMoney)&&count.test(withoutMoney))||(count.test(withoutMoney)&&quantityQuestion&&fruit.test(normalize(context.history||'')+' '+previous));
  };
  return lesson.objectives.filter(objective=>{
    const act=objective.id.split(':')[1];
    return clauses.some(value=>{
      if(objective.evidence.some(evidence=>phraseIn(value,evidence)))return true;
      if(act==='introduce')return variants.name.test(value)||variants.origin.test(value);
      if(act==='shop')return variants.price.test(value)||quantity(value);
      if(act==='quantity')return quantity(value);
      return Boolean(variants[act]?.test(value));
    });
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
