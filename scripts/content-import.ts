import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Reproducible source import, not a language-quality certification.
const source = 'https://kaikki.org/dictionary/Balinese/kaikki.org-dictionary-Balinese.jsonl';
const response = await fetch(source);
if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
const text = await response.text();
const snapshotSha256 = createHash('sha256').update(text).digest('hex');
const importedAt = new Date().toISOString();
type Sense = { id?: string; glosses?: string[]; raw_glosses?: string[]; tags?: string[]; examples?: { text: string; english?: string; translation?: string; type?: string }[] };
type Word = { word: string; lang_code: string; pos: string; senses: Sense[]; head_templates?: { name: string; args: Record<string,string>; expansion?: string }[] };
const priorities = new Set('tiang titiang ring niki puniki punika rahajeng becik wasta aji siki kalih dua telu patpat lima nem pitu kutus sia dasa kopi nasi yeh baas biu woh peken pasar meli beli adol karya magaé makarya guru anyar rauh teka mulih luas jalan umah uma sane napi nyén dija kenken nguda kénkén ada tusing ten sampun durung wantah lan miwah sareng ajengan wedang wédang wengi tengai semeng sore adan demen suka éling inget tulung urip nyemak ngaba ngidih cang bapa meme ibu anak nini bibi adik nyama tamiu'.split(' '));
const useful = /\b(coffee|rice|water|tea|fruit|banana|mango|orange|coconut|sugar|salt|food|eat|drink|buy|sell|price|market|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|name|house|room|door|village|road|path|come|go|leave|I|me|you|we|this|that|in|at|good|new|old|big|small|morning|night|day|work|teacher|friend|family|mother|father|sister|brother|child|sit|stand|want|know|ask|give|take|say|hear|speak|read|write|help|thank|yes|no|not|from|hot|cold|sweet|tasty|many|much|cheap|expensive)\b/i;
const exclude = /\b(penis|vagina|vulva|testicle|sexual|semen|intercourse|prostitut|fuck|shit|feces|faeces|anus|genital|weapon|ritual|offering|sacred|hindu|islam|god|spirit|demon|deity|calendar|myth|mantra|priest|sacrifice)\b/i;
const candidates = new Map<string,{ row: Word; sense: Sense; score:number; register:string }>();
for (const line of text.trim().split('\n')) {
  const row = JSON.parse(line) as Word;
  if (row.lang_code !== 'ban' || !/^[a-zà-ž][a-zà-ž '\-]*$/u.test(row.word) || ['name','character','symbol'].includes(row.pos)) continue;
  const sense = row.senses.find(s => s.glosses?.length && !s.tags?.some(t => ['vulgar','offensive','obsolete','historical','alt-of','form-of'].includes(t)) && !/^(alternative|balinese spelling|inflection|plural|passive)/i.test(s.glosses[0]) && !exclude.test(s.glosses.join(' ')));
  if (!sense?.id) continue;
  const sourceLabels = [...(sense.raw_glosses ?? []), ...(row.head_templates ?? []).filter(t => t.name === 'tlb').map(t => t.expansion ?? '')].join(' ');
  // Preserve explicit source labels only; never infer register from a translation.
  const register = sourceLabels.match(/alus singgih|alus mider|alus madya|alus sor|basa alus|medya|media|andap|kasar|alus/i)?.[0].toLowerCase() ?? 'unknown';
  if (register === 'kasar') continue;
  const score = (priorities.has(row.word) ? 100 : 0) + (useful.test(sense.glosses!.join(' ')) ? 20 : 0) + (row.pos === 'num' ? 10 : 0) + (sense.examples?.some(x=>x.english) ? 5 : 0);
  const current = candidates.get(row.word);
  if (!current || score > current.score) candidates.set(row.word, { row, sense, score, register });
}
const selected = [...candidates.values()].sort((a,b)=>b.score-a.score || a.row.word.localeCompare(b.row.word,'en')).slice(0,200);
if (selected.length !== 200) throw new Error(`Only ${selected.length} source candidates; refusing to pad.`);
const lexicon = selected.map(({row,sense,register})=>({
  id: `wikt:${sense.id}`, bali: row.word, indonesia: '', english: sense.glosses!.join('; '), category: row.pos,
  register, levelIds: ['warung','kos','pasar','boss'], sourceUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(row.word)}#Balinese`,
  sourceTitle: `Wiktionary contributors: ${row.word} (Balinese)`,
  sourceRevision: `Kaikki snapshot SHA-256 ${snapshotSha256}`, license: 'CC-BY-SA-4.0', status: 'sourced', variants: [],
}));
const provenance = Object.fromEntries(selected.map(({row,sense})=>[`wikt:${sense.id}`,{
  kind:'dictionary', upstreamSenseId:sense.id, originalEnglish:sense.glosses, rawLabels:sense.raw_glosses??[],
  sourceExamples:(sense.examples??[]).filter(e=>e.english && (!e.type || e.type==='example')).map(e=>({bali:e.text,english:e.english})),
  importedAt, snapshotSha256, extractUrl:source, attribution:'Wiktionary contributors; extraction by Tatu Ylönen / Wiktextract (Kaikki.org)',
  licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/', changes:'Selected one sense per Latin lemma; Indonesian gloss will be an AI translation. No quoted external-source examples or audio imported.',
}]));
await mkdir(resolve('src/content'),{recursive:true});
await writeFile(resolve('src/content/lexicon.json'),JSON.stringify(lexicon,null,2)+'\n');
await writeFile(resolve('src/content/lexicon-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({imported:lexicon.length,source,snapshotSha256}));
