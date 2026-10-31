import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

try { process.loadEnvFile('.env'); } catch { /* Environment injection is also supported. */ }
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error('OPENROUTER_API_KEY is required. No records changed.');
const model = process.env.OPENROUTER_CONTENT_REVIEW_MODEL || 'google/gemini-3.8-flash';
const paths = ['src/content/lexicon.json','src/content/teaching-notes.json','src/content/phrases.json'];
type Entry = {id:string;bali:string;indonesia:string;english:string;register:string;sourceUrl:string;status:string;category:string};
type Review = {id:string;accepted:boolean;indonesia:string;issues:string[];suggestedBali:string;suggestedEnglish:string};
const groups = await Promise.all(paths.map(async path=>JSON.parse(await readFile(path,'utf8')) as Entry[]));
const entries=groups.flat();
const allById=Object.fromEntries(entries.map(x=>[x.id,x]));
const provenance = {...JSON.parse(await readFile('src/content/lexicon-provenance.json','utf8')),...JSON.parse(await readFile('src/content/authored-provenance.json','utf8'))} as Record<string,{kind:string;supportingIds?:string[];sourceExamples?:unknown[];originalEnglish?:string[];rawLabels?:string[]}>;
let reviews: Record<string,unknown> = {};
try { reviews=JSON.parse(await readFile('src/content/reviews.json','utf8')); } catch { /* First run. */ }
const wanted = process.argv.slice(2);
const selected = entries.filter(x=>!wanted.length || wanted.some(arg=>x.id.startsWith(arg)));
// Facts first so useful authored exercises are available before the larger word list.
selected.sort((a,b)=>Number(a.id.startsWith('wikt:'))-Number(b.id.startsWith('wikt:')));
const schema={type:'object',additionalProperties:false,required:['results'],properties:{results:{type:'array',items:{type:'object',additionalProperties:false,required:['id','accepted','indonesia','issues','suggestedBali','suggestedEnglish'],properties:{id:{type:'string'},accepted:{type:'boolean'},indonesia:{type:'string'},issues:{type:'array',items:{type:'string'}},suggestedBali:{type:'string'},suggestedEnglish:{type:'string'}}}}}};
for(let offset=0;offset<selected.length;offset+=24) {
  const batch=selected.slice(offset,offset+24);
  const input=batch.map(entry=>({...entry,provenance:provenance[entry.id],supportingFacts:(provenance[entry.id]?.supportingIds??[]).map(id=>allById[id])}));
  const inputHash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',signal:AbortSignal.timeout(180000),
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','HTTP-Referer':'https://ngraos.docker.anatera.app','X-Title':'Ngraos content consistency review'},
    body:JSON.stringify({model,provider:{require_parameters:true,data_collection:'deny'},temperature:0.1,max_tokens:10000,
      response_format:{type:'json_schema',json_schema:{name:'content_review',strict:true,schema}},
      messages:[{role:'system',content:'You are a conservative secondary automated reviewer of a beginner Balinese learning corpus, NOT a native-speaker validator. Check each supplied candidate against its attached lexical source evidence and reasonable Balinese grammar. Source presence is not proof a gloss is right. Return exactly one result per input ID. Accept ordinary clear dictionary senses; flag suspicious meanings, unsafe mixing of levels of speech, unnatural authored phrases, or misleading translations. Authored short combinations and proper-name/place substitutions are allowed if lexical evidence and grammar suffice; they are adaptations, not attested complete source sentences. Do not demand every proper name or Indonesian loan/place name be in the dictionary. Do not demand expert validation: no expert is available. Do not infer unknown register, certify pronunciation, or assert native accuracy. For accepted entries return an accurate concise Indonesian gloss or sentence translation. For rejected entries still translate the actual English, explain issues and optionally suggest a minimal corrected Balinese and English; empty strings when no suggestion. Preserve each input ID exactly. Reject source contradictions instead of silently rewriting source English. Review source-example words in the supplied examples as evidence. Accept narrow source-derived senses even if another sense is common; glossary supports multiple registers with explicit notes. All output must be JSON matching the schema.'},
      {role:'user',content:JSON.stringify({task:'Consistency review only, not expert validation',entries:input})}]}),
  });
  if(!response.ok) throw new Error(`OpenRouter review failed HTTP ${response.status}; completed batches remain recorded.`);
  const result=await response.json() as {id?:string;model?:string;provider?:string;usage?:unknown;choices?:{message:{content?:string}}[]};
  const content=result.choices?.[0]?.message?.content;
  if(!content) throw new Error('Review returned no structured content. Completed batches remain recorded.');
  const parsed=JSON.parse(content) as {results:Review[]};
  if(!Array.isArray(parsed.results)||parsed.results.length!==batch.length||new Set(parsed.results.map(x=>x.id)).size!==batch.length||parsed.results.some(x=>!batch.some(e=>e.id===x.id)||typeof x.accepted!=='boolean'||typeof x.indonesia!=='string'||!Array.isArray(x.issues))) throw new Error('Review ID/schema mismatch; current batch not applied.');
  for(const review of parsed.results) {
    const entry=allById[review.id];
    entry.indonesia=review.indonesia;
    entry.status=review.accepted?'ai-reviewed':'draft';
    reviews[entry.id]={...review,reviewerModel:result.model??model,provider:result.provider??null,requestId:result.id??null,reviewedAt:new Date().toISOString(),inputSha256:inputHash,method:'Separate model consistency check against supplied source evidence',expertValidated:false};
  }
  for(let i=0;i<paths.length;i++) await writeFile(paths[i],JSON.stringify(groups[i],null,2)+'\n');
  await writeFile('src/content/reviews.json',JSON.stringify(reviews,null,2)+'\n');
  console.log(JSON.stringify({reviewed:offset+batch.length,total:selected.length,accepted:parsed.results.filter(x=>x.accepted).length,rejected:parsed.results.filter(x=>!x.accepted).map(x=>({id:x.id,issues:x.issues,suggestedBali:x.suggestedBali,suggestedEnglish:x.suggestedEnglish})),model:result.model??model}));
}
