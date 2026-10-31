import { readFile, writeFile } from 'node:fs/promises';

// This builds explicitly authored candidates. Only content-review.ts can record a
// separate model review; rerunning this file intentionally resets these drafts.
const lexicon = JSON.parse(await readFile('src/content/lexicon.json','utf8')) as {id:string;bali:string;sourceUrl:string}[];
const lex = Object.fromEntries(lexicon.map(entry=>[entry.bali,entry.id]));
const allLevels = ['warung','kos','pasar','boss'];
const factRows = [
  ['suksma','Ungkapan terima kasih','Expression of thanks','mider','https://basaibubali.org/Suksma'],
  ['pamit','Meminta izin untuk pergi','To take leave','alus sor','https://basaibubali.org/Pamit'],
  ['kuda','Kata tanya untuk jumlah atau harga','Question word for quantity or price','mider','https://basaibubali.org/Kuda'],
  ['saking','Dari; menunjukkan asal','From; marks origin','alus mider','https://basaibubali.org/Saking'],
  ['nunas','Meminta; memohon','To request','alus sor','https://basaibubali.org/Nunas'],
  ['dados','Bisa atau boleh, sesuai konteks','Can or may, depending on context','unknown','https://basaibubali.org/Dados'],
  ['kirang','Kurang; lebih sedikit','Less; lacking','andap','https://basaibubali.org/Kirang'],
  ['tali','Ribu, dalam ungkapan bilangan','Thousand, in number expressions','andap','https://basaibubali.org/Tali'],
  ['wastan','Nama, diikuti pemilik nama','Name, followed by its bearer','alus sor','https://basaibubali.org/Wastan'],
  ['mekarya','Bekerja','To work','unknown','https://en.wiktionary.org/wiki/ring#Balinese'],
  ['semeng','Pagi, dalam ungkapan salam','Morning, in a greeting','unknown','https://en.wiktionary.org/wiki/rahajeng#Balinese'],
  ['wengi','Malam, dalam ungkapan salam','Evening or night, in a greeting','unknown','https://en.wiktionary.org/wiki/rahajeng#Balinese'],
  ['pisan','Sangat, sebagai penguat','Very; an intensifier','unknown','https://en.wiktionary.org/wiki/becik#Balinese'],
] as const;
const facts = factRows.map(([bali,indonesia,english,register,sourceUrl])=>({
  id:`fact:${bali}`,bali,indonesia,english,register,category:'teaching-note',levelIds:allLevels,
  sourceUrl,sourceTitle:sourceUrl.includes('wiktionary')?`Wiktionary source example: ${bali}`:`BASAibu reference: ${bali}`,
  license:sourceUrl.includes('wiktionary')?'CC-BY-SA-4.0':'Original factual teaching note; linked reference retains copyright',
  status:'sourced',variants:[],
}));
const factsByWord = Object.fromEntries(facts.map(x=>[x.bali,x]));
const phraseRows: Record<string, {objective:string;bali:string;indonesia:string;english:string;support:string[]}[]> = {};
function add(level:string,objective:string,bali:string,indonesia:string,english:string,support:string[]) {
  (phraseRows[level]??=[]).push({objective,bali,indonesia,english,support});
}
for (const [bali,id,en] of [
  ['Rahajeng semeng.','Selamat pagi.','Good morning.'],
  ['Rahajeng wengi.','Selamat malam.','Good evening.'],
  ['Rahajeng semeng, Men Sari.','Selamat pagi, Men Sari.','Good morning, Men Sari.'],
  ['Rahajeng wengi, Men Sari.','Selamat malam, Men Sari.','Good evening, Men Sari.'],
  ['Rahajeng semeng. Suksma.','Selamat pagi. Terima kasih.','Good morning. Thank you.'],
  ['Rahajeng wengi. Suksma.','Selamat malam. Terima kasih.','Good evening. Thank you.'],
]) add('warung','warung:greet',bali,id,en,['rahajeng',bali.includes('semeng')?'semeng':'wengi',...(bali.includes('Suksma')?['suksma']:[])]);
for (const [bali,id,en] of [
  ['Suksma.','Terima kasih.','Thank you.'],
  ['Suksma, Men Sari.','Terima kasih, Men Sari.','Thank you, Men Sari.'],
  ['Suksma pisan.','Terima kasih banyak.','Thank you very much.'],
  ['Nggih, suksma.','Ya, terima kasih.','Yes, thank you.'],
  ['Suksma. Tiang pamit.','Terima kasih. Saya pamit.','Thank you. I will take my leave.'],
  ['Suksma pisan, Men Sari.','Terima kasih banyak, Men Sari.','Thank you very much, Men Sari.'],
]) add('warung','warung:thank',bali,id,en,['suksma',...(bali.includes('pisan')?['pisan']:[]),...(bali.includes('Nggih')?['nggih']:[]),...(bali.includes('pamit')?['tiang','pamit']:[])]);
for (const [bali,id,en] of [
  ['Tiang pamit.','Saya pamit.','I will take my leave.'],
  ['Titiang pamit.','Saya mohon pamit.','I will take my leave.'],
  ['Tiang pamit, Men Sari.','Saya pamit, Men Sari.','I will take my leave, Men Sari.'],
  ['Titiang pamit, Men Sari.','Saya mohon pamit, Men Sari.','I will take my leave, Men Sari.'],
  ['Nggih, tiang pamit.','Baik, saya pamit.','All right, I will take my leave.'],
  ['Tiang pamit. Suksma pisan.','Saya pamit. Terima kasih banyak.','I will take my leave. Thank you very much.'],
]) add('warung','warung:farewell',bali,id,en,['tiang','titiang','pamit',...(bali.includes('Suksma')?['suksma','pisan']:[]),...(bali.includes('Nggih')?['nggih']:[])]);

for (const name of ['Ayu','Rian','Made','Sari','Wayan','Komang']) add('kos','kos:name',`Wastan titiang ${name}.`,`Nama saya ${name}.`,`My name is ${name}.`,['wastan','titiang']);
for (const place of ['Denpasar','Ubud','Jimbaran','Singaraja','Karangasem','Tabanan']) add('kos','kos:origin',`Tiang saking ${place}.`,`Saya dari ${place}.`,`I am from ${place}.`,['tiang','saking']);
for (const place of ['Denpasar','Ubud','Jimbaran','Singaraja','Karangasem','Tabanan']) add('kos','kos:work',`Tiang mekarya ring ${place}.`,`Saya bekerja di ${place}.`,`I work in ${place}.`,['tiang','mekarya','ring']);

for (const [thing,id,en] of [['niki','ini','this'],['puniki','ini','this'],['biu niki','pisang ini','these bananas'],['poh niki','mangga ini','this mango'],['juwuk niki','jeruk ini','these oranges'],['nyuh niki','kelapa ini','this coconut']]) add('pasar','pasar:price',`Aji kuda ${thing}?`,`Berapa harga ${id}?`,`How much is ${en}?`,['aji','kuda',...thing.split(' ')]);
for (const [fruit,id,en] of [['biu','pisang','banana'],['poh','mangga','mango'],['juwuk','jeruk','orange']]) {
  add('pasar','pasar:quantity',`Tiang nunas ${fruit} siki.`,`Saya minta satu ${id}.`,`I would like one ${en}.`,['tiang','nunas',fruit,'siki']);
  add('pasar','pasar:quantity',`Tiang nunas ${fruit} kalih.`,`Saya minta dua ${id}.`,`I would like two ${en}s.`,['tiang','nunas',fruit,'kalih']);
}
for (const [bali,id,en] of [
  ['Dados kirang?','Boleh lebih murah?','Could it be less?'],
  ['Dados kirang, nggih?','Boleh lebih murah, ya?','Could you lower the price, please?'],
  ['Aji niki dados kirang?','Harga ini boleh dikurangi?','Could this price be lower?'],
  ['Dados lima tali?','Boleh lima ribu?','Could it be five thousand?'],
  ['Dados dasa tali?','Boleh sepuluh ribu?','Could it be ten thousand?'],
  ['Dados kirang? Suksma.','Boleh lebih murah? Terima kasih.','Could it be less? Thank you.'],
]) add('pasar','pasar:bargain',bali,id,en,['dados','kirang',...(bali.includes('nggih')?['nggih']:[]),...(bali.includes('Aji')?['aji','niki']:[]),...(bali.includes('lima')?['lima','tali']:[]),...(bali.includes('dasa')?['dasa','tali']:[]),...(bali.includes('Suksma')?['suksma']:[])]);

for (const name of ['Ayu','Rian','Made','Sari','Wayan','Komang']) add('boss','boss:greet',`Rahajeng semeng. Wastan titiang ${name}.`,`Selamat pagi. Nama saya ${name}.`,`Good morning. My name is ${name}.`,['rahajeng','semeng','wastan','titiang']);
for (const [name,place] of [['Ayu','Denpasar'],['Rian','Ubud'],['Made','Jimbaran'],['Sari','Singaraja'],['Wayan','Karangasem'],['Komang','Tabanan']]) add('boss','boss:introduce',`Wastan titiang ${name}. Tiang saking ${place}.`,`Nama saya ${name}. Saya dari ${place}.`,`My name is ${name}. I am from ${place}.`,['wastan','titiang','tiang','saking']);
for (const [fruit,id,en] of [['biu','pisang','bananas'],['poh','mangga','mangoes'],['juwuk','jeruk','oranges']]) {
  add('boss','boss:shop',`Aji kuda ${fruit} niki? Dados kirang?`,`Berapa harga ${id} ini? Boleh lebih murah?`,`How much are these ${en}? Could it be less?`,['aji','kuda',fruit,'niki','dados','kirang']);
  add('boss','boss:shop',`Tiang nunas ${fruit} kalih. Suksma.`,`Saya minta dua ${id}. Terima kasih.`,`I would like two ${en}. Thank you.`,['tiang','nunas',fruit,'kalih','suksma']);
}
const phraseProvenance: Record<string,unknown> = {};
const phrases = Object.entries(phraseRows).flatMap(([level,rows])=>rows.map((row,i)=>{
  const id=`phrase:${level}-${String(i+1).padStart(2,'0')}`;
  const supportingIds=[...new Set(row.support.map(word=>factsByWord[word]?.id??lex[word]??(()=>{throw new Error(`Missing evidence: ${word}`)})()))];
  const firstFact=row.support.map(word=>factsByWord[word]).find(Boolean);
  const sourceUrl=firstFact?.sourceUrl??lexicon.find(x=>x.id===supportingIds[0])!.sourceUrl;
  phraseProvenance[id]={kind:'authored-variant',objectiveId:row.objective,supportingIds,authoredBy:'Ngraos content preparation (AI-assisted)',expertValidated:false,changes:'Original practice sentence assembled from linked lexical facts or adapted from a Wiktionary example; proper names and places are practice substitutions. Source pages do not attest this complete sentence.'};
  return {id,bali:row.bali,indonesia:row.indonesia,english:row.english,category:'phrase',register:'unknown',levelIds:level==='boss'?['boss']:[level,'boss'],sourceUrl,sourceTitle:'Ngraos authored practice; lexical references linked in provenance',license:'CC-BY-SA-4.0 (authored/adapted practice; references retain their own licenses)',status:'draft',variants:[]};
}));
const factProvenance=Object.fromEntries(facts.map(x=>[x.id,{kind:x.sourceUrl.includes('wiktionary')?'source-example-fact':'reference-fact',authoredBy:'Ngraos content preparation (AI-assisted)',expertValidated:false,referenceCheckedAt:'2026-10-31',referenceUrl:x.sourceUrl,changes:'Short original factual teaching note; no extended source expression or media reproduced.'}]));
await writeFile('src/content/teaching-notes.json',JSON.stringify(facts,null,2)+'\n');
await writeFile('src/content/phrases.json',JSON.stringify(phrases,null,2)+'\n');
await writeFile('src/content/authored-provenance.json',JSON.stringify({...factProvenance,...phraseProvenance},null,2)+'\n');
console.log(JSON.stringify({teachingNotes:facts.length,authoredPhraseCandidates:phrases.length}));
