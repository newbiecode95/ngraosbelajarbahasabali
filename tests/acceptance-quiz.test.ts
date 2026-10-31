import { describe, expect, it } from 'vitest';
import { corpus } from '../src/content/corpus';
import { sessionView, validateQuestions } from '../src/server/game';
import { correctionIsSupported } from '../src/server/rules';
import type { QuizDraft } from '../src/server/openrouter';

const phrase=corpus.find(entry=>entry.id==='phrase:warung-01')!;
const thanks=corpus.find(entry=>entry.id==='phrase:warung-07')!;
function draft(type:QuizDraft['type'],answer:string,sourceId:string):QuizDraft {
  return {type,answer,sourceId,mistakeId:null,prompt:{id:'Pilih ungkapan yang sesuai.',en:'Choose the matching expression.'},options:type==='choice'?[answer,'Tiang pamit.','Wastan titiang Ayu.','Aji kuda niki?']:[]};
}
function cleanQuiz():QuizDraft[] {
  return [draft('choice',thanks.bali,thanks.id),draft('order',phrase.bali,phrase.id),draft('repeat',phrase.bali,phrase.id),draft('choice',phrase.bali,phrase.id),draft('repeat',thanks.bali,thanks.id)];
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
      expect(()=>validateQuestions(questions,[phrase,thanks],[])).toThrow();
    }
  });

  it('keeps repetition targets available while hiding choice/order keys and answer variants',()=>{
    const questions=cleanQuiz();
    const repeat=questions.find(q=>q.type==='repeat')!;
    repeat.prompt.id=`Dengarkan dan ulangi ${repeat.answer}`;
    const privateQuiz=validateQuestions(questions,[phrase,thanks],[]);
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
    expect(()=>validateQuestions(badSource,[phrase,thanks],[])).toThrow();
    const badMistake=cleanQuiz();badMistake[0].mistakeId='invented:mistake';
    expect(()=>validateQuestions(badMistake,[phrase,thanks],[])).toThrow();
  });
});
