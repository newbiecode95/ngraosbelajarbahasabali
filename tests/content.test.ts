import { describe, it, expect } from 'vitest';
import { corpus, getCorpusEntry, provenance } from '../src/content/corpus';
import { getLesson, lessons } from '../src/content/lessons';
import reviews from '../src/content/reviews.json';
import { objectiveMatches } from '../src/server/rules';

describe('playable source-backed curriculum',()=>{
  it('provides an eligible practice answer for every mission objective',()=>{
    for (const lesson of lessons) {
      expect(lesson.objectives).toHaveLength(3);
      const practiced = new Set<string>();
      for (const id of lesson.phrases) {
        const entry=getCorpusEntry(id);
        expect(entry,`${lesson.id}: missing phrase ${id}`).toBeDefined();
        expect(entry!.status,`${id}: unreviewed draft cannot be a fallback`).not.toBe('draft');
        expect(entry!.levelIds).toContain(lesson.id);
        objectiveMatches(lesson,entry!.bali).forEach(id=>practiced.add(id));
      }
      expect([...practiced]).toEqual(expect.arrayContaining(lesson.objectives.map(x=>x.id)));
    }
    expect(()=>getLesson('unrecognised-level')).toThrow();
  });

  it('resolves provenance and distinguishes authored adaptations from dictionary senses',()=>{
    const ids = new Set(corpus.map(x=>x.id));
    expect(ids.size).toBe(corpus.length);
    for(const entry of corpus) {
      expect(entry.sourceUrl).toMatch(/^https:\/\/(en\.wiktionary\.org|basaibubali\.org)\//);
      expect(entry.license.length).toBeGreaterThan(0);
      const metadata=provenance[entry.id as keyof typeof provenance] as {kind:string;supportingIds?:string[]};
      expect(metadata,`${entry.id} lacks provenance`).toBeDefined();
      if(entry.id.startsWith('phrase:')) {
        expect(metadata.kind).toBe('authored-variant');
        expect(metadata.supportingIds!.length).toBeGreaterThan(0);
        for(const sourceId of metadata.supportingIds!) expect(ids.has(sourceId),`Missing support ${sourceId}`).toBe(true);
      }
    }
  });

  it('never labels a candidate AI reviewed without an actual accepted review record',()=>{
    for(const entry of corpus.filter(x=>x.status==='ai-reviewed')) {
      const review=reviews[entry.id as keyof typeof reviews];
      expect(review,entry.id).toBeDefined();
      expect(review.accepted).toBe(true);
      expect(review.reviewerModel).toContain('gemini');
      expect(review.requestId).toBeTruthy();
      expect(review.expertValidated).toBe(false);
      expect(entry.indonesia.trim().length).toBeGreaterThan(0);
    }
  });
});
