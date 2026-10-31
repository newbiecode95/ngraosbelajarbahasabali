import type { Lesson, LevelId } from '../lib/types';

export const lessons: Lesson[] = [
  {
    id:'warung',number:1,title:'Warung Men Sari',npc:'Men Sari',voice:'Kore',color:'#EA8C55',
    subtitle:{id:'Sapaan kecil, cerita baru',en:'Small greetings, new stories'},
    role:{id:'Pemilik warung',en:'Warung owner'},
    description:{id:'Singgah di warung Men Sari. Sapa dengan hangat, ucapkan terima kasih, lalu pamit sebelum melanjutkan perjalanan.',en:'Stop at Men Sari’s warung. Say hello, thank her, and say goodbye before your next adventure.'},
    objectives:[
      {id:'warung:greet',title:{id:'Sapa Men Sari',en:'Greet Men Sari'},evidence:['rahajeng semeng','rahajeng wengi']},
      {id:'warung:thank',title:{id:'Ucapkan terima kasih',en:'Say thank you'},evidence:['suksma']},
      {id:'warung:farewell',title:{id:'Pamit dengan ramah',en:'Say goodbye'},evidence:['tiang pamit','titiang pamit']},
    ],
    opening:'Rahajeng semeng.',openingTranslation:{id:'Selamat pagi.',en:'Good morning.'},
    phrases:['phrase:warung-01','phrase:warung-07','phrase:warung-13'],
    album:{title:{id:'Sapaan pertama',en:'Your first greeting'},text:{id:'Rahajeng semeng adalah ungkapan sapaan pagi. Nama panggilan seperti Men Sari membantu percakapan terasa akrab. Perhatikan konteks saat memilih cara menyapa.',en:'Rahajeng semeng is a morning greeting. A form of address such as Men Sari makes an exchange personal. Notice the context when choosing how to greet someone.'}},
  },
  {
    id:'kos',number:2,title:'Kos Bu Komang',npc:'Bu Komang',voice:'Aoede',color:'#649A7D',
    subtitle:{id:'Kenalan dengan tetangga baru',en:'Meet your new neighbour'},
    role:{id:'Pemilik kos',en:'Boarding-house host'},
    description:{id:'Bu Komang ingin mengenal penghuni barunya. Ceritakan nama, daerah asal, dan tempat kamu bekerja.',en:'Bu Komang would like to know her new resident. Introduce your name, where you are from, and where you work.'},
    objectives:[
      {id:'kos:name',title:{id:'Perkenalkan nama',en:'Introduce your name'},evidence:['wastan tiang','wastan titiang','adan tiang']},
      {id:'kos:origin',title:{id:'Ceritakan daerah asal',en:'Say where you are from'},evidence:['tiang saking','titiang saking']},
      {id:'kos:work',title:{id:'Ceritakan tempat kerja',en:'Say where you work'},evidence:['tiang mekarya ring','titiang mekarya ring','tiang makarya ring']},
    ],
    opening:'Rahajeng semeng. Wastan titiang Komang.',openingTranslation:{id:'Selamat pagi. Nama saya Komang.',en:'Good morning. My name is Komang.'},
    phrases:['phrase:kos-01','phrase:kos-07','phrase:kos-13'],
    album:{title:{id:'Cerita tentang diri',en:'A little about you'},text:{id:'Wastan titiang digunakan untuk memperkenalkan nama. Saking membantu menyebut asal, sedangkan ring dapat menunjukkan tempat. Coba ganti nama dan tempat pada contoh dengan ceritamu sendiri.',en:'Wastan titiang introduces your name. Saking helps express where you are from, while ring can mark a location. Replace the example names and places with your own story.'}},
  },
  {
    id:'pasar',number:3,title:'Pasar Pagi',npc:'Pak Made',voice:'Puck',color:'#D6AC49',
    subtitle:{id:'Pilih buah, mulai percakapan',en:'Pick some fruit, start a conversation'},
    role:{id:'Penjual buah',en:'Fruit seller'},
    description:{id:'Keranjang buah menanti di pasar. Tanyakan harga, sebutkan jumlah yang kamu mau, lalu coba meminta harga lebih rendah.',en:'A basket of fruit awaits at the market. Ask the price, say how many you would like, and try asking for a lower price.'},
    objectives:[
      {id:'pasar:price',title:{id:'Tanyakan harga',en:'Ask the price'},evidence:['aji kuda']},
      {id:'pasar:quantity',title:{id:'Sebutkan jumlah buah',en:'Say how much fruit you want'},evidence:['biu siki','biu kalih','poh siki','poh kalih','juwuk siki','juwuk kalih']},
      {id:'pasar:bargain',title:{id:'Coba menawar',en:'Try bargaining'},evidence:['dados kirang','dados lima tali','dados dasa tali']},
    ],
    opening:'Rahajeng semeng.',openingTranslation:{id:'Selamat pagi.',en:'Good morning.'},
    phrases:['phrase:pasar-01','phrase:pasar-07','phrase:pasar-13'],
    album:{title:{id:'Obrolan di pasar',en:'Market conversations'},text:{id:'Biu berarti pisang dan poh berarti mangga. Siki dan kalih menyatakan satu dan dua dalam contoh latihan ini. Saat berbelanja, jumlah dan harga memberi banyak kesempatan untuk berlatih percakapan singkat.',en:'Biu means banana and poh means mango. Siki and kalih express one and two in these practice examples. Quantities and prices create opportunities for short conversations while shopping.'}},
  },
  {
    id:'boss',number:4,title:'Petualangan Terakhir',npc:'Pak Wayan',voice:'Charon',color:'#8B83B7',
    subtitle:{id:'Satukan semua yang kamu pelajari',en:'Bring everything you learned together'},
    role:{id:'Tetangga di pasar',en:'Neighbour at the market'},
    description:{id:'Bertemu Pak Wayan dalam satu percakapan utuh. Mulai dengan sapaan, perkenalkan diri, lalu ajak berbincang tentang belanja buah.',en:'Meet Pak Wayan in one complete conversation. Start with a greeting, introduce yourself, and talk about buying fruit.'},
    objectives:[
      {id:'boss:greet',title:{id:'Buka dengan sapaan',en:'Open with a greeting'},evidence:['rahajeng semeng','rahajeng wengi']},
      {id:'boss:introduce',title:{id:'Perkenalkan diri',en:'Introduce yourself'},evidence:['wastan tiang','wastan titiang','tiang saking','titiang saking']},
      {id:'boss:shop',title:{id:'Tanyakan harga atau jumlah',en:'Talk about prices or quantities'},evidence:['aji kuda','biu siki','biu kalih','poh siki','poh kalih','juwuk siki','juwuk kalih']},
    ],
    opening:'Rahajeng semeng. Wastan titiang Wayan.',openingTranslation:{id:'Selamat pagi. Nama saya Wayan.',en:'Good morning. My name is Wayan.'},
    phrases:['phrase:boss-01','phrase:boss-07','phrase:boss-13'],
    album:{title:{id:'Berani ngraos',en:'Ready to keep talking'},text:{id:'Kamu sudah mencoba sapaan, perkenalan, dan belanja dalam percakapan. Latihan singkat yang diulang membantu ungkapan terasa lebih mudah digunakan. Koleksi ini mencatat langkahmu; terus perhatikan situasi dan lawan bicara.',en:'You have practised greetings, introductions, and shopping in conversation. Repeating short exchanges helps expressions become easier to use. This collection records your progress; keep paying attention to the situation and the person you are speaking with.'}},
  },
];

export function getLesson(id: LevelId | string): Lesson {
  const lesson = lessons.find(item=>item.id===id);
  if (!lesson) throw new Error(`Unknown lesson: ${id}`);
  return lesson;
}
