# Visual and audio assets

The original images were generated for Ngraos with the built-in OpenAI image-generation tool (`image_gen`), then copied into the project and encoded as WebP with Sharp. No stock-photo, Google Images, or third-party game assets are bundled. Runtime language AI and character speech use OpenRouter; artwork generation during development is separate from application runtime.

| Asset | Purpose | Published file |
|---|---|---|
| Desa Kenderan | Village navigation and layered scene background | `public/images/desa-bali.webp` |
| Men Sari | Warung character | `public/images/sari.webp` |
| Bu Komang | Guesthouse character | `public/images/komang.webp` |
| Pak Made | Market character | `public/images/pedagang.webp` |
| Pak Wayan | Chapter boss / village elder | `public/images/wayan.webp` |

The original generated PNGs remain in the user's Codex generated-images directory. The application uses the smaller WebP files, with transparent NPC backgrounds. Image generation created static paintings; CSS supplies cloud drift, character states, object interactions and a speaking badge driven by audio amplitude, while the painted character remains still. This is a 2.5D layered interface, not a fully navigable 3D world or phoneme-level facial rig.

## Generation prompts

The village and initial three portraits used the following art direction (condensed prompt records):

- **Village:** premium hand-painted 2.5D isometric Balinese village for a cozy adult language-learning game; warm cream, terracotta and sage palette; a small tea/food warung on the left, morning fruit market in the upper middle, guesthouse on the right, stream and bridge in the foreground, palms and rice terraces; layered richly detailed illustration with open areas for location markers; no text, logos, people, or sacred offerings.
- **Men Sari:** transparent waist-up Balinese woman running a village warung, welcoming expression, cream blouse and warm apron, holding a cup of tea; premium soft watercolor/gouache 2.5D game illustration, warm muted palette, no text or background.
- **Bu Komang:** transparent waist-up Balinese guesthouse owner, warm attentive adult woman, sage blouse and a key; same painterly warm storybook direction, expressive face, no text or background.
- **Pak Made:** transparent waist-up Balinese fruit seller, warm friendly adult man in ochre clothing and simple udeng, fruit in hand; same painterly warm storybook direction, no text or background.

Final Pak Wayan prompt:

> Create one premium storybook game character sprite, transparent background, for the cozy Balinese language-learning web game Ngraos. Waist-up portrait of Pak Wayan, a friendly Balinese village elder around 60 years old, warm medium-brown skin, kind attentive face, smiling relaxed mouth, short silver hair, simple cream Balinese udeng headcloth, moss-green short-sleeved collared shirt, subtle woven cream sash, one hand gently raised in greeting. Contemporary everyday village clothing, respectful and grounded, no ceremonial deity or religious symbols. Warm hand-painted 2.5D watercolor/gouache illustration, fine soft textured edges, muted sage green and golden cream palette, beautifully detailed expressive face, approachable adult character not childish, no text, no logos, no setting. Center composition with generous transparent margin, full head and both shoulders and hands visible; bottom fades neatly at waist. Single person only.

## Sound and fonts

The quiet stream/wind atmosphere is synthesized locally with Web Audio noise and a low-pass filter. It starts after a user interaction, fades while in a conversation, and follows mute and document visibility. It contains no recorded player speech. NPC voices are explicitly disclosed as AI generated.

DM Sans Variable and Outfit Variable are bundled through `@fontsource-variable` packages with their included open-font license files. Lucide provides the interface icons under its ISC license. Learning-text attribution and share-alike terms are separate; see `src/content/README.md`.

The welcome screen adds an illustrated gateway in `public/images/welcome-kenderan.webp` and a smaller mobile variant. Generation prompt and credits: [welcome/artwork.md](welcome/artwork.md).
