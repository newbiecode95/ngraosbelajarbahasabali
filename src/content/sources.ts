export const sources = [
  {
    id: 'wiktionary-balinese', title: 'Wiktionary contributors — Balinese',
    url: 'https://en.wiktionary.org/wiki/Category:Balinese_language',
    extractUrl: 'https://kaikki.org/dictionary/Balinese/kaikki.org-dictionary-Balinese.jsonl',
    license: 'CC-BY-SA-4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    termsUrl: 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use',
    attribution: 'Wiktionary contributors; extraction by Tatu Ylönen / Wiktextract (Kaikki.org).',
    use: 'Selected definitions and source examples; Indonesian translations and authored adaptations are identified separately.',
  },
  {
    id: 'basaibu-reference', title: 'BASAibu Bali — individual dictionary references',
    url: 'https://basaibubali.org/DictionaryIndex',
    license: 'Source retains copyright; reference only',
    licenseUrl: 'https://basaibu.org/our-policies/',
    termsUrl: 'https://basaibu.org/our-policies/',
    attribution: 'BASAibu and the individual contributors linked in each entry.',
    use: 'Individual lexical facts consulted for original teaching notes. No source examples, articles, audio or illustrations are reproduced.',
  },
] as const;

export const contentPolicy = {
  expertValidated: false,
  reviewMeaning: 'ai-reviewed means a separate model checked consistency against supplied source material. It does not establish native-speaker accuracy.',
  unknownRegister: 'Keep unknown whenever the source does not explicitly establish a register. Do not grade politeness based on an inferred register.',
  authoredLicense: 'CC-BY-SA-4.0 (Ngraos authored/adapted teaching text; linked reference pages retain their own rights)',
  sourceChanges: 'Selected senses, normalized metadata, Indonesian translations and authored practice variants. Individual source URLs and snapshot hashes are retained.',
} as const;
