import type { CorpusEntry, Localized } from '../lib/types';
import { normalize, phraseIn } from './rules';

export interface ChoiceChallenge { sourceId:string; answer:string; prompt:Localized; options:string[] }
function meaningWords(entry:CorpusEntry) {
  const common=new Set(['a','an','the','to','of','in','on','and','or','dan','atau','yang','untuk','di','sejenis','kata']);
  return new Set(normalize(`${entry.indonesia} ${entry.english}`.replace(/\([^)]*\)/g,' ')).split(' ').filter(word=>word&&!common.has(word)));
}

// Every alternative is a reviewed corpus phrase. Authored scenarios distinguish
// one meaning explicitly; equivalent spellings are never marked wrong.
export function choiceChallenge(entry:CorpusEntry,entries:CorpusEntry[]):ChoiceChallenge|undefined {
  const byId=new Map(entries.filter(e=>e.status!=='draft').map(e=>[e.id,e]));
  function challenge(ids:string[],prompt:Localized):ChoiceChallenge|undefined {
    const options=ids.map(id=>byId.get(id)?.bali);
    if(options.some(v=>!v)||new Set(options.map(v=>normalize(v!))).size!==4||!options.some(v=>normalize(v!)===normalize(entry.bali)))return;
    if(phraseIn(prompt.id,entry.bali)||phraseIn(prompt.en,entry.bali))return;
    return {sourceId:entry.id,answer:entry.bali,prompt,options:options as string[]};
  }
  const index=Number(entry.id.match(/-(\d+)$/)?.[1]);
  const id=(group:string,n:number)=>`phrase:${group}-${String(n).padStart(2,'0')}`;
  if(entry.id.startsWith('phrase:pasar-')&&index>=7&&index<=12){
    const fruits=[['pisang','banana'],['mangga','mango'],['jeruk','orange']];
    const fruit=Math.floor((index-7)/2),count=index%2===0?2:1,other=(fruit+1)%3;
    return challenge([index,index%2===0?index-1:index+1,7+other*2,8+other*2].map(n=>id('pasar',n)),{
      id:count===2?`Kamu dan temanmu masing-masing ingin satu ${fruits[fruit][0]}. Pesan jumlah yang cukup untuk kalian berdua.`:`Temanmu tidak ikut membeli. Pesan satu ${fruits[fruit][0]} untuk dirimu.`,
      en:count===2?`You and your friend each want one ${fruits[fruit][1]}. Order enough for both of you.`:`Your friend is not buying anything. Order one ${fruits[fruit][1]} for yourself.`,
    });
  }
  if(entry.id.startsWith('phrase:pasar-')&&index>=3&&index<=6){
    const fruits=[['pisang','bananas'],['mangga','mangoes'],['jeruk','oranges'],['kelapa','coconuts']];
    const fruit=index-3,prior=(fruit+1)%4;
    return challenge([3,4,5,6].map(n=>id('pasar',n)),{id:`Harga ${fruits[prior][0]} sudah kamu tahu. Sekarang tanyakan harga ${fruits[fruit][0]} yang ditunjuk pedagang.`,en:`You already know the price of ${fruits[prior][1]}. Now ask the price of the ${fruits[fruit][1]} the seller is pointing to.`});
  }
  if(entry.id.startsWith('phrase:kos-')&&index>=7&&index<=18){
    const cities=['Denpasar','Ubud','Jimbaran','Singaraja','Karangasem','Tabanan'];
    const work=index>=13,city=(index-7)%6,other=(city+1)%6;
    const origin=work?other:city,job=work?city:other;
    return challenge([7+city,13+city,7+other,13+other].map(n=>id('kos',n)),{
      id:`Kamu berasal dari ${cities[origin]} dan bekerja di ${cities[job]}. Bu Komang bertanya ${work?'di mana kamu bekerja':'dari mana asalmu'}. Pilih jawaban yang sesuai.`,
      en:`You come from ${cities[origin]} and work in ${cities[job]}. Bu Komang asks ${work?'where you work':'where you come from'}. Choose your reply.`,
    });
  }
  if(entry.id==='phrase:warung-05'||entry.id==='phrase:warung-06'){
    const morning=index===5;
    return challenge([1,2,5,6].map(n=>id('warung',n)),{id:`Men Sari membantumu ${morning?'pagi':'malam'} ini. Sapa dia sekaligus ucapkan terima kasih dalam satu jawaban.`,en:`Men Sari helps you this ${morning?'morning':'evening'}. Greet her and thank her in the same reply.`});
  }
  const polite=['suksma','nggih','nénten','sampun'];
  if(polite.includes(normalize(entry.bali))){
    const words=polite.filter(word=>word!==normalize(entry.bali)).map(word=>entries.find(e=>normalize(e.bali)===word&&e.status!=='draft'));
    const prompts:Record<string,Localized>={
      suksma:{id:'Pesananmu sudah diantar. Kamu ingin mengucapkan terima kasih. Pilih ucapan yang menyatakan rasa terima kasih.',en:'Your order has arrived. Choose the expression that conveys thanks.'},
      nggih:{id:'Men Sari bertanya apakah pesananmu sudah benar. Pilih kata untuk menjawab ya dengan sopan.',en:'Men Sari asks whether your order is correct. Choose the polite word for yes.'},
      'nénten':{id:'Pilih kata penyangkalan yang berarti tidak dalam ragam sopan.',en:'Choose the polite negative word meaning no or not.'},
      sampun:{id:'Men Sari bertanya apakah kamu sudah makan. Pilih kata yang berarti sudah.',en:'Men Sari asks whether you have eaten. Choose the word meaning already.'},
    };
    if(words.every(Boolean))return challenge([entry.id,...words.map(e=>e!.id)],prompts[normalize(entry.bali)]);
  }
  // Lexical mistakes get alternatives of the same part of speech and similar
  // length, rather than a lone word surrounded by unrelated full sentences.
  if(!entry.id.startsWith('phrase:')&&!entry.bali.includes(' ')){
    const teachingParts:Record<string,string>={pamit:'verb',kuda:'pron',saking:'adv',nunas:'verb',dados:'verb',kirang:'adj',tali:'num',wastan:'noun',mekarya:'verb',semeng:'noun',wengi:'noun',pisan:'adv'};
    const part=entry.id.startsWith('fact:')?teachingParts[entry.bali]:entry.category;
    const functionWords=['conj','det','prep','pron','adv'];
    const meaning=meaningWords(entry);
    const alternatives=entries.filter(e=>e.id.startsWith('wikt:')&&e.status!=='draft'&&(e.category===part||(functionWords.includes(part)&&functionWords.includes(e.category)))&&!e.bali.includes(' ')&&normalize(e.bali)!==normalize(entry.bali)&&![...meaningWords(e)].some(word=>meaning.has(word))&&!entry.variants.some(v=>normalize(v)===normalize(e.bali))&&!e.variants.some(v=>normalize(v)===normalize(entry.bali)))
      .sort((a,b)=>Number(b.category===part)-Number(a.category===part)||Math.abs(a.bali.length-entry.bali.length)-Math.abs(b.bali.length-entry.bali.length)||a.id.localeCompare(b.id));
    if(alternatives.length>=3)return challenge([entry.id,...alternatives.slice(0,3).map(e=>e.id)],{id:`Kata mana yang berarti “${entry.indonesia}”?`,en:`Which word means “${entry.english}”?`});
  }
}

export function choiceChallenges(entries:CorpusEntry[],candidates=entries) {
  return candidates.flatMap(entry=>{const value=choiceChallenge(entry,entries);return value?[value]:[];});
}
