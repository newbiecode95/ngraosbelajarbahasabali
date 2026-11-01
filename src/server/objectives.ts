import type { Lesson, Turn } from '../lib/types';
import { normalize, objectiveMatches, phraseIn, playerActClauses } from './rules';
type Evidence={objectiveId:string;quote:string};
type Utterance=Pick<Turn,'playerText'|'reply'|'translation'>;

export function resolveObjectives(lesson:Lesson,turns:Utterance[],semantic:Evidence[]=[]):string[] {
  const found=new Set<string>();
  for(let i=0;i<turns.length;i++){
    const previous=turns[i-1];
    const context={previousReply:previous?[previous.reply,previous.translation.id,previous.translation.en].join(' '):'',history:turns.slice(0,i).map(t=>t.playerText).join(' ')};
    for(const id of objectiveMatches(lesson,turns[i].playerText,context))found.add(id);
  }
  for(const evidence of semantic){
    if(!lesson.objectives.some(o=>o.id===evidence.objectiveId)||!normalize(evidence.quote))continue;
    // The model classifies intent; the server requires real learner evidence,
    // an allowed objective and an actual act, not an NPC line or score request.
    if(turns.some(turn=>phraseIn(turn.playerText,evidence.quote)&&phraseIn(playerActClauses(turn.playerText).join(' '),evidence.quote)))found.add(evidence.objectiveId);
  }
  return lesson.objectives.map(o=>o.id).filter(id=>found.has(id));
}
