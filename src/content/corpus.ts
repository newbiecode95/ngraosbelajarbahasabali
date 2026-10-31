import type { CorpusEntry } from '../lib/types';
import lexicon from './lexicon.json';
import teachingNotes from './teaching-notes.json';
import phrases from './phrases.json';
import lexicalProvenance from './lexicon-provenance.json';
import authoredProvenance from './authored-provenance.json';

export const corpus: CorpusEntry[] = [...lexicon, ...teachingNotes, ...phrases] as CorpusEntry[];
export const provenance = { ...lexicalProvenance, ...authoredProvenance };
export const getCorpusEntry = (id: string) => corpus.find(entry => entry.id === id);
export { sources, contentPolicy } from './sources';
export { default as reviewMetadata } from './reviews.json';
