import { describe, expect, it } from 'vitest';
import { currentMission, missionGuides } from '../src/content/guidance';
import { lessons } from '../src/content/lessons';
import { corpus } from '../src/content/corpus';
import { objectiveMatches } from '../src/server/rules';

describe('authored gameplay guidance',()=>{
  it('gives every objective a usable instruction in both interface languages',()=>{
    for(const lesson of lessons)for(const objective of lesson.objectives){
      const guide=missionGuides[objective.id];
      expect(guide.instruction.id.length).toBeGreaterThan(20);expect(guide.instruction.en.length).toBeGreaterThan(20);
      if(lesson.id==='boss'){expect(guide.phraseId).toBeUndefined();continue;}
      const example=corpus.find(entry=>entry.id===guide.phraseId)!;
      expect(example).toBeDefined();expect(example.status).not.toBe('draft');expect(lesson.phrases).toContain(example.id);
      expect(objectiveMatches(lesson,example.bali)).toContain(objective.id);
    }
  });
  it('advances from actual saved completion, including goals completed out of order',()=>{
    const lesson=lessons[0];
    expect(currentMission(lesson,[])?.id).toBe('warung:greet');
    expect(currentMission(lesson,['warung:greet','warung:farewell'])?.id).toBe('warung:thank');
    expect(currentMission(lesson,lesson.objectives.map(item=>item.id))).toBeUndefined();
  });
});
