# Ngraos content provenance

The corpus contains dictionary **candidates**, short factual teaching notes, and authored practice variants. Candidate count is not a claim about fluency, pronunciation accuracy, or suitability for every social context. There is no native-speaker or teacher validation.

The 2026-10-31 consistency run reviewed all 285 candidates with `google/gemini-3.8-flash`: 195 of 200 dictionary candidates, all 13 short teaching notes, and all 72 authored variants were accepted. Five suspicious imported senses (`bau`, `dasi`, `indra`, `uku`, and `asrama`) remain drafts with the original source gloss and reviewer objection preserved. This is an automated consistency result, not a measured language-accuracy rate.

- `lexicon.json`: 200 Latin-script Balinese headwords with one selected Wiktionary sense. The exact source English, extract URL, import timestamp, source examples and SHA-256 snapshot are preserved in `lexicon-provenance.json`. Wiktionary material is CC BY-SA 4.0; retain attribution, indicate changes, and preserve share-alike licensing for derived text when redistributing it.
- `teaching-notes.json`: short original language facts consulted in individual BASAibu pages or Wiktionary examples. BASAibu is a **reference**, not an openly licensed imported corpus. Its source pages, media and extended example texts are not copied. Reference URLs remain attached; their rights remain with the respective contributors.
- `phrases.json`: 72 authored/adapted practice candidates. `authored-provenance.json` identifies their objective, supporting corpus IDs and the fact that the complete sentence is an adaptation, not an attested source quotation. Proper names and places are illustrative substitutions. Authored/adapted practice text is CC BY-SA 4.0; that does not relicense the referenced BASAibu pages.
- `reviews.json`: actual separate OpenRouter Gemini consistency responses, request IDs, model, timestamp, supplied-input hash, acceptance and issues. The reviewer receives supplied extracts/teaching notes; URLs do not mean it independently fetched the pages. An automated check cannot establish native-speaker accuracy. Source registers remain explicit or `unknown`; the model is not allowed to invent them.

`sourced` means an entry has an identified source. `ai-reviewed` additionally means a separate model accepted the supplied content in a recorded consistency check. `draft` is excluded from graded retrieval and fallback answers. These labels are not an expert approval scale. Lessons use only eligible core phrases and must still pass the curriculum integrity test.

Rebuild candidates from the network:

```sh
node --experimental-strip-types scripts/content-import.ts
node --experimental-strip-types scripts/content-author.ts
```

These commands intentionally reset generated candidates to `sourced` or `draft`. They do **not** perform review. After checking source/license changes, run an actual separate review with a server-side `OPENROUTER_API_KEY`:

```sh
node --experimental-strip-types scripts/content-review.ts
# Prefix filtering is available for a smaller paid review:
node --experimental-strip-types scripts/content-review.ts phrase: fact:
npx vitest run tests/content.test.ts
```

The review script sends these public teaching texts to OpenRouter and incurs API charges. It does not send user conversations or print the key. Completed batches are saved; a failed request does not fabricate a review. Inspect rejected candidates and make source-supported changes before rerunning their review. Keep deployment source credits linked to `sources.ts` and each corpus entry.

Unlicensed government dictionary PDFs, BASAibu articles/media, and sentiment datasets are not included. The teaching dataset does not include harvested personal conversations.
