import { describe, expect, it } from 'vitest';
import { corpus } from '../src/content/corpus';
import { sessionView, validateQuestions, buildPracticeQuiz } from '../src/server/game';
import { correctionIsSupported } from '../src/server/rules';
import type { QuizDraft } from '../src/server/openrouter';
import { choiceChallenge, choiceChallenges } from '../src/server/quiz-choices';

const phrase=corpus.find(entry=>entry.id==='phrase:warung-01')!;
const thanks=corpus.find(entry=>entry.id==='phrase:warung-07')!;
const entries=corpus.filter(e=>e.status!=='draft');
it('provides five checked exercises after malformed model quizzes, without inventing mistakes',()=>{
  const entries=corpus.filter(e=>e.status!=='draft'&&e.levelIds.includes('warung'));
  const reinforcement=buildPracticeQuiz(entries,[]);
  expect(reinforcement).toHaveLength(5);expect(reinforcement.every(q=>q.reinforcement)).toBe(true);
  const personalized=buildPracticeQuiz(entries,[{id:'real-error',correction:{correct:thanks.bali,sourceId:thanks.id}}]);
  expect(personalized.filter(q=>q.mistakeId==='real-error')).toHaveLength(4);
  expect(new Set(personalized.map(q=>q.type)).size).toBe(3);
});
function draft(type:QuizDraft['type'],answer:string,sourceId:string):QuizDraft {
  return {type,answer,sourceId,mistakeId:null,prompt:{id:'Pilih ungkapan yang sesuai.',en:'Choose the matching expression.'},options:type==='choice'?[answer,'Tiang pamit.','Wastan titiang Ayu.','Aji kuda niki?']:[]};
}
function cleanQuiz():QuizDraft[] {
  const combined=corpus.find(e=>e.id==='phrase:warung-05')!;
  return [draft('choice',thanks.bali,thanks.id),draft('order',phrase.bali,phrase.id),draft('repeat',phrase.bali,phrase.id),draft('choice',combined.bali,combined.id),draft('repeat',thanks.bali,thanks.id)];
}

describe('source grounding and quiz privacy acceptance',()=>{
  it('does not let a real source word certify an invented full correction',()=>{
    expect(correctionIsSupported({correct:`Kalimat rekaan tanpa dukungan ${thanks.bali}`,type:'grammar'},thanks)).toBe(false);
    expect(correctionIsSupported({correct:thanks.bali,type:'vocabulary'},thanks)).toBe(true);
  });

  it.each(['choice','order'] as const)('rejects a %s prompt that prints its correct answer in either locale',type=>{
    for(const locale of ['id','en'] as const) {
      const questions=cleanQuiz();
      const question=questions.find(q=>q.type===type)!;
      question.prompt[locale]=`Jawab dengan: ${question.answer}`;
      expect(()=>validateQuestions(questions,entries,[])).toThrow();
    }
  });

  it('keeps repetition targets available while hiding choice/order keys and answer variants',()=>{
    const questions=cleanQuiz();
    const repeat=questions.find(q=>q.type==='repeat')!;
    repeat.prompt.id=`Dengarkan dan ulangi ${repeat.answer}`;
    const privateQuiz=validateQuestions(questions,entries,[]);
    const session=sessionView({id:'fixture',player_id:'fixture',level_id:'warung',status:'quiz',turns:[],completed_objectives:[],hints_used:0,quiz:privateQuiz,result:null});
    expect(session.quiz).toHaveLength(5);
    for(const q of session.quiz!) {
      expect(q).not.toHaveProperty('answer');
      expect(q).not.toHaveProperty('variants');
      if(q.type==='repeat') expect(q.target).toBeTruthy();
      else expect(q).not.toHaveProperty('target');
      expect(q.reinforcement).toBe(true);
      expect(q.mistakeId).toBeUndefined();
    }
  });

  it('does not accept a fabricated source ID or fabricated learner mistake',()=>{
    const badSource=cleanQuiz();badSource[0].sourceId='invented:source';
    expect(()=>validateQuestions(badSource,entries,[])).toThrow();
    const badMistake=cleanQuiz();badMistake[0].mistakeId='invented:mistake';
    expect(()=>validateQuestions(badMistake,entries,[])).toThrow();
  });
  it('replaces model giveaways with reviewed contextual contrasts and four sourced alternatives',()=>{
    const drafts=cleanQuiz();const checked=validateQuestions(drafts,entries,[]);
    expect(checked[0].options?.map(v=>v.toLowerCase().replace(/\./g,''))).toEqual(expect.arrayContaining(['suksma','nggih','nénten','sampun']));
    const quantity=choiceChallenge(corpus.find(e=>e.id==='phrase:pasar-08')!,entries)!;
    expect(quantity.prompt.id).toContain('masing-masing');
    expect(quantity.options).toEqual(['Tiang nunas biu kalih.','Tiang nunas biu siki.','Tiang nunas poh siki.','Tiang nunas poh kalih.']);
    const workplace=choiceChallenge(corpus.find(e=>e.id==='phrase:kos-13')!,entries)!;
    expect(workplace.options).toEqual(['Tiang saking Denpasar.','Tiang mekarya ring Denpasar.','Tiang saking Ubud.','Tiang mekarya ring Ubud.']);
    const pronoun=choiceChallenge(corpus.find(e=>e.bali==='tiang')!,entries)!;
    expect(pronoun.options).not.toContain('titiang');
    const negative=choiceChallenge(corpus.find(e=>e.bali==='tusing')!,entries)!;
    expect(negative.options).not.toContain('nénten');
    for(const c of choiceChallenges(entries)){
      expect(new Set(c.options).size).toBe(4);
      expect(c.options.filter(o=>o===c.answer)).toHaveLength(1);
      for(const option of c.options)expect(entries.some(e=>e.bali===option)).toBe(true);
    }
  });
  it('keeps four authentic mistake links and all types for every supported correction source',()=>{
    // Covers single-word mistakes as well as whole phrases, across all lessons.
    for(const entry of entries){
      let quiz;try{quiz=buildPracticeQuiz(entries,[{id:'actual',correction:{correct:entry.bali,sourceId:entry.id}}]);}catch(e){throw new Error(entry.id,{cause:e});}
      expect(quiz.filter(q=>q.mistakeId==='actual'),entry.id).toHaveLength(entry.bali.split(/\s+/).length>=2||choiceChallenge(entry,entries)?4:3);
      expect(new Set(quiz.map(q=>q.type)).size,entry.id).toBe(3);
    }
  });
  it('finds suitable mistake material beyond the first four errors',()=>{
    const cognate=entries.find(e=>e.bali==='dua')!;
    const mistakes=[...Array.from({length:4},(_,i)=>({id:`word-${i}`,correction:{correct:cognate.bali,sourceId:cognate.id}})),{id:'later-phrase',correction:{correct:phrase.bali,sourceId:phrase.id}}];
    const quiz=buildPracticeQuiz(entries,mistakes);
    expect(quiz.filter(q=>q.mistakeId)).toHaveLength(4);
    expect(quiz.some(q=>q.type==='order'&&q.mistakeId==='later-phrase')).toBe(true);
    expect(new Set(quiz.map(q=>q.type)).size).toBe(3);
  });
});
