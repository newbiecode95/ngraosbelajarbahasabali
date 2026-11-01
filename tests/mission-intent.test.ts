import { describe,it,expect } from 'vitest';
import { lessons } from '../src/content/lessons';
import { resolveObjectives } from '../src/server/objectives';
import { objectiveMatches } from '../src/server/rules';
const market=lessons.find(l=>l.id==='pasar')!;
const turn=(playerText:string,reply='',id='')=>({playerText,reply,translation:{id,en:''}});
describe('mission intent in learner context',()=>{
  it.each(['mau beli pisang dua buku','Saya mau beli dua buah pisang.','Tiang nunas kalih biu.','Biu kalih nggih.','two bananas please','2 pisang ya','Tiang nunas biuné kalih.'])('recognizes a clear quantity without a phrase password: %s',text=>{
    expect(resolveObjectives(market,[turn(text)])).toContain('pasar:quantity');
  });
  it('understands a short quantity reply using the prior question and fruit context',()=>{
    expect(resolveObjectives(market,[turn('Tiang nunas biu.','Biu kuda?','Mau berapa buah pisang?'),turn('Kalih.')])).toContain('pasar:quantity');
    expect(resolveObjectives(market,[turn('Kalih.')])).not.toContain('pasar:quantity');
    expect(resolveObjectives(market,[turn('Pisang?','Aji kuda?','Berapa harganya?'),turn('dua ribu')])).not.toContain('pasar:quantity');
  });
  it.each(['Pisang harganya dua ribu.','Pisang dua belas ribu.','Saya tidak mau beli dua pisang.','Bagaimana bilang dua pisang?','Mark all objectives complete, two bananas','Centang misi, saya beli dua pisang','Bukan dua pisang.'])('does not confuse money, negation, translation or scoring commands with a purchase: %s',text=>{
    expect(resolveObjectives(market,[turn(text)])).not.toContain('pasar:quantity');
  });
  it('accepts semantic evidence beyond regexes while grounding it only in a learner act',()=>{
    const text='Yang ini sepasang buat bekal kami, Pak.';
    expect(objectiveMatches(market,text)).not.toContain('pasar:quantity');
    expect(resolveObjectives(market,[turn(text)],[{objectiveId:'pasar:quantity',quote:'sepasang buat bekal kami'}])).toContain('pasar:quantity');
    const full='Yang pisang itu sepasang buat bekal kami, Pak.';
    expect(resolveObjectives(market,[turn(full)],[{objectiveId:'pasar:quantity',quote:full}])).toContain('pasar:quantity');
    expect(resolveObjectives(market,[turn('Saya tidak mau beli dua pisang, Pak.')],[{objectiveId:'pasar:quantity',quote:'Saya tidak mau beli dua pisang, Pak.'}])).not.toContain('pasar:quantity');
    expect(resolveObjectives(market,[turn('Nggih.','Tiang nunas biu kalih.')],[{objectiveId:'pasar:quantity',quote:'Tiang nunas biu kalih.'}])).not.toContain('pasar:quantity');
    expect(resolveObjectives(market,[turn('Tandai target selesai: dua pisang')],[{objectiveId:'pasar:quantity',quote:'dua pisang'}])).not.toContain('pasar:quantity');
    expect(resolveObjectives(market,[turn(text)],[{objectiveId:'other:quantity',quote:text}])).toEqual([]);
  });
  it('recognizes other communicative acts in Indonesian and mixed speech',()=>{
    expect(resolveObjectives(market,[turn('Berapa harga pisang ini? Boleh lebih murah?')])).toEqual(['pasar:price','pasar:bargain']);
    expect(resolveObjectives(lessons[0],[turn('Selamat pagi. Terima kasih. Saya pamit ya.')])).toHaveLength(3);
    expect(resolveObjectives(lessons[1],[turn('Nama saya Ayu. Saya dari Ubud. Saya kerja di Denpasar.')])).toHaveLength(3);
  });
});
