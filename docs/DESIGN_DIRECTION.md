# Design direction

## Reference study: alajo.app

The brief named alajo.app as visual inspiration. It was inspected in a real browser (Chromium via Playwright) at desktop width (1440 px) and mobile width (390 px): full-page screenshots, computed fonts, colour frequencies, heading sizes and corner radii. Nothing from the site (logo, photographs, illustrations, copy, claims, testimonials, award logos or contact details) is used in NextStep.

What we observed:

| Aspect | Observation |
|---|---|
| Typography | Heavy geometric sans headlines (~36–48 px, weight 700) with **one keyword set in the brand colour** (“…low Income **People**”). Body text in a quieter sans (Graphik/Archivo), short paragraphs with bold lead-ins. |
| Colour | Mostly white canvas with a single saturated brand green, soft mint section bands, and small pastel accents (pink eyebrow pill, peach/yellow/lavender icon chips). Near-black text. |
| Tactility | Primary buttons and the closing call-to-action panel use a **hard black offset shadow**, which feels physical and youthful without heavy gradients. |
| Composition | Hero split into copy + product image on desktop, stacked copy-first on mobile. Large **soft circles bleeding off the page edges** add movement. Generous vertical spacing between sections. |
| Cards | White cards with 12–16 px radii, soft borders/shadows, generous padding; feature grids of small cards each led by a pastel icon chip. |
| Storytelling | Hand-drawn curly arrows next to section headings; a named-person story; product screenshots inside phone frames; photography of real people. |
| Mobile | Single column, hamburger menu, full-width images, centred section titles, comfortable line height. |
| Proof | Press logos, awards, testimonials and statistics — **we deliberately have no equivalent**, because NextStep has no real users, press or awards yet and must not invent them. |

## Principles adopted

1. **Confident type, one accent word.** Big, tight Bricolage Grotesque headlines with a single highlighted word or phrase; Plus Jakarta Sans for reading. Clear hierarchy beats decoration.
2. **Tactile, not glossy.** Buttons and key cards have a 2 px ink border and a 4 px hard offset shadow that “presses” to 1 px — the same treatment on web and mobile (`tactile` tokens).
3. **Warm canvas, purposeful colour.** A warm cream canvas instead of pure white (calmer for long reading, kinder in bright sunlight), one strong brand colour, and supporting colours that each carry one meaning.
4. **Illustration tells the story; screenshots prove it.** An original mascot and scenes explain *feelings* (overwhelmed → recovered). Real screenshots of the implemented app and demo show *what it does*. No fake screenshots.
5. **Honest proof.** Where a typical landing page would show testimonials and awards, NextStep shows the Recovery Mode walkthrough, a clearly-labelled fictional scenario (Tobi) and a working demo.
6. **Mobile first, low-data aware.** Single-column layouts, system-friendly font loading, vector illustrations as inline SVG (no illustration image downloads), real PNG screenshots only where they prove something.

## NextStep identity

**Name and line:** NextStep — *Plans change. Keep moving.* By Team Apex.

**Personality:** confident, youthful, optimistic, never preachy. Supportive language (“You still have a next step.”) instead of guilt.

### Colour (semantic tokens, `packages/design-tokens`)

| Token | Light | Meaning |
|---|---|---|
| `primary` | Violet `#5534F0` | Brand, primary actions, focus. |
| `reward` | Marigold `#FFC52E` | XP, levels, celebrations — never a warning. |
| `energy` | Coral `#FF7D5E` | Mascot energy, highlights, the “My plans changed” entry point. |
| `calm` | Lagoon `#149EB3` | Focus mode, information, calm states. |
| `success` / `warning` / `danger` | Green / orange / red | Status only, always paired with text or an icon. |
| `canvas` | Sand `#FFFBF5` | Warm page background. |
| Ink | `#17142E` | Text and the hard tactile shadow. |

Dark mode has its own tuned values (night canvas `#100E1F`, lighter violet `#9C8AFF`), not inverted colours. Text/background pairs are tested for contrast in `tokens.test.ts` (primary text ≥ 7:1, secondary text ≥ 4.5:1 on canvas and surfaces, both themes).

### Type

- Display: **Bricolage Grotesque** 700–800 (headlines, numbers).
- Text: **Plus Jakarta Sans** 400–700.
- Scale (mobile): display 34/40, h1 28/34, h2 22/28, down to caption; the web scales headlines fluidly with `clamp()`.
- Both fonts are open source (SIL OFL), loaded via `next/font` on the web and `@expo-google-fonts` on mobile.

### Shape and depth

Radii 10 / 14 / 20 / 28 / pill. Borders 1 px hairline or 2 px tactile. Shadows are hard offsets (4 px → 1 px pressed), not blurs.

### Mascot: Nex

An original, code-drawn violet character with a leaf sprout, big eyes and sneakers — a small companion who is always *moving to the next stepping stone*. Seven poses (welcome, focus, encourage, recovery, celebrate, rest, thinking), six colour skins and seven accessories unlocked through gamification. Nex never scolds; the rest pose appears on rest days and after finishing for the day.

### Illustration language

Flat shapes, 2–3 px ink outlines, soft pastel discs behind subjects (echoing our own stepping stones rather than another brand’s motifs), dotted path lines for “the route”, small sparkles. Scenes: onboarding (organise, plan, recover), empty states (tasks, plan, resources, done, offline, journey), and a hero scene of Nex rerouting along stepping stones toward a flag. Badges are rosette shapes with a symbol per achievement. All are SVG strings in `packages/illustrations` rendered on both platforms.

### Motion and sound

- Short, purposeful motion (tokens: 90 / 160 / 240 / 380 ms; 900 ms for a celebration): button press, sheet entry, a brief mascot hop, celebration only for real achievements.
- `prefers-reduced-motion` (web) and the OS reduce-motion setting (mobile) are respected; the app also has its own motion setting.
- Sound is **off by default**; haptics are optional.

### Iconography

Lucide icons (ISC licence), 1.75–2 px stroke, always with a text label for actions.

## How the reference shaped — and didn’t shape — NextStep

| Borrowed as a principle | Made our own |
|---|---|
| Accent keyword in bold headlines | Our violet + Bricolage Grotesque, our own copy |
| Hard offset “tactile” buttons | Ink-bordered tactile system extended to cards, chips and the mobile app |
| Soft shapes for movement | Stepping-stone discs and dotted routes tied to our recovery metaphor |
| Pastel icon chips in feature grids | Chips coloured by meaning (reward / energy / calm) |
| Doodle arrows near headings | Our own doodle: a dotted stepping path ending in a forward hop |
| Real people photography | **Not used**: we have no consented photography, so we use the mascot and real product screenshots instead |
| Press, awards, testimonials, statistics | **Not used**: none exist; the site says so plainly |
