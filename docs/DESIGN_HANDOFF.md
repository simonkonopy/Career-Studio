# Career Studio design handoff

Updated September 9, 2026. This package preserves Fable’s redesigned 29-slide presentation theme and the current Career Studio dashboard. The detailed interview applies to every entered skill, including AI, accounting, programming, and custom skills.

## Start with these files

| File | Purpose |
| --- | --- |
| [Current PowerPoint](CAREER_STUDIO_HANDOFF_2026-09-09.pptx) | Editable reference for Fable’s presentation theme, slide layouts, workflow diagrams, and tables. |
| [Current PDF](CAREER_STUDIO_HANDOFF_2026-09-09.pdf) | Visual reference for the finished deck. |
| [Design settings](design/tokens.json) | Recorded UI and presentation colors, typography, and layout settings. These document the design; the application does not load this JSON. |
| [Artwork manifest](design/ASSET_MANIFEST.json) | Included artwork, provenance, usage, and checksums. |
| `design/assets/` | Reusable copies of the cover and section artwork already used in the presentation. |
| `../public/app.css` | Authoritative application styles, responsive rules, focus states, and print styling. |
| `../public/app.js` and `../public/demo.js` | Shared interface and the isolated fictional demo. |

Use the current PowerPoint as the slide-editing starting point. The earlier 24-slide content drafts do not contain the full redesigned navigation, section dividers, and workflow diagrams. Product behavior and claims come from the current README, engineering guide, and sales playbook.

## Fable’s presentation theme

The theme uses a navy cover and section dividers, white content slides, bordered pale cards, clear title rules, audience labels, and numbered workflow diagrams. Preserve those elements when revising the deck.

| Element | Current treatment |
| --- | --- |
| Canvas | 16:9, 13.333 × 7.5 inches. |
| Typeface | Helvetica Neue. Check font availability before editing or exporting. If a receiving machine requires a replacement, choose it deliberately and inspect every slide for reflow. |
| Main colors | Navy `#0B2545`, body ink `#171717`, secondary text `#52677F`, borders `#C9D6E8`, pale fill `#F3F6FB`, white `#FFFFFF`. |
| Section accents | Product: green `#1F7A5A`; engineering: blue `#175CD4`; pilot and selling: amber `#C2410C`. |
| Content hierarchy | Part label and audience at the top, title, short takeaway, horizontal rule, then the content. |
| Type scale | Content titles around 30 pt, takeaways 15 pt, card text 14–16 pt, small labels 10–12 pt, footers 9 pt. Preserve the actual sizes in each existing layout. |
| Page frame | Approximately 0.6-inch side margins, consistent card spacing, and a footer with the handoff date and `slide / total`. |
| Artwork | Keep the navy artwork panels in their existing proportions. Use the included originals when a slide needs the same artwork. |
| Tables | Editable PowerPoint tables on slides 19 and 28; preserve the navy headers and alternate pale rows. |

The presentation’s green product-section accent identifies a section of the deck. The dashboard’s primary action color is blue. Keep these recorded treatments intact when updating either surface.

### Reading order and diagrams

The current deck has 29 slides:

- Slides 1–3: cover, reader-specific starting paths, and agenda.
- Slides 4–13: product, customer journey, skill depth, and fictional demo screens.
- Slides 14–22: implementation, AI access, architecture, and launch work.
- Slides 23–29: pilot risks, customer experiment, sales demo, packaging, measures, and next actions.

Use editable connected blocks for sequences and instructions. Preserve the existing diagrams on slides 2, 7, 16, 17, 18, 20, 22, 25, 26, and 29. Keep arrow direction, step order, labels, and the distinction between implemented and deferred work clear. Keep the reader labels: Everyone, Engineer, and Product Owner.

### Product screenshots

Slides 8, 10, 11, 12, and 13 contain fictional demo screenshots and numbered explanations. They already show the current interface. Slide 10 includes the any-skill chooser and review flow; slide 9 explains AI, accounting, programming, and custom skills.

When the application changes, capture fresh fictional `/demo` screens and update each numbered explanation to match the visible control. Retain the disclosure: **Fictional demo. AI examples are simulated.** Never replace these images with real customer records. Keep photographs and artwork separate from product screenshots.

## Dashboard theme to preserve

The application uses a pale blue-gray canvas, white cards, navy text, and blue primary actions. `public/app.css` contains the full implementation, including later rules that refine earlier styles. Read the entire cascade before consolidating it.

| Role | Current CSS value |
| --- | --- |
| Primary action | `--accent: #1f5fd0` |
| Strong primary text/hover | `--accent-dark: #174aa6` |
| Text | `--ink: #172538` |
| Secondary text | `--muted: #5c6b7f` |
| Selected/pale blue | `--tint: #e6eefc` |
| Page canvas | `--canvas: #f4f7fb` |
| Cards | `--paper: #fff` |
| Borders | `--line: #d8e1ee` |
| Error | `--danger: #a63a35` |

The shell uses the system sans-serif stack at a 15 px base with 1.55 line height. Georgia appears in selected brand/editorial accents and resume presentation. Preserve the current hierarchy and readable form labels rather than applying the presentation’s type scale to the app.

Keep the desktop sidebar and visible active navigation, clickable overview statistics, profile progress, and labeled save states. Preserve the wide-screen layout from 1500 px and the responsive column changes at 1100 px and 750 px, including compact mobile navigation. Custom skill names must wrap, and skill-level controls must remain usable on narrow screens.

Maintain keyboard focus indicators, the skip link, reduced-motion support, and resume-specific print rules. State must be understandable through text as well as color. Keep the demo banner visible so visitors understand that its data and AI replies are simulated.

## Skill controls are part of the design

The skill chooser accepts existing or custom names. AI, accounting, and programming chips are conversation starters. Naming a skill does not establish a level or add a resume claim.

The interface distinguishes independent tasks, tasks completed with help, learning, and tasks not yet done. A custom task requires an explicit level. Preserve supporting examples, unsaved-state messages, duplicate-task protection, and the visible retry when the saved-task limit is reached. Reviewed assistance must remain clear in resume wording.

## Updating and transferring the design

1. Edit the current deck and application files in this standalone product package. Keep the existing theme while changing content.
2. Check desktop and mobile views, including the interview, long custom task names, profile review, and resume export. Application behavior changes should pass the product’s relevant checks.
3. Export the deck to a new file, render every slide, and check text fit, font substitution, diagrams, and screenshot callouts. Review both the PowerPoint and PDF.
4. Update the README links, this guide, and the artwork manifest when their referenced files change. Refresh the source ZIP from the final product files.

The handoff contains the themed PowerPoint and PDF, this guide, design settings, reusable artwork, and the dashboard’s actual styling. It does not require the parent personal job-search repository or its historical deck builders. The artwork manifest records the supplied source of each included image.
