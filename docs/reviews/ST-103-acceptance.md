# Acceptance – ST-103: Privacy notice and imprint written in the museum settings
Date: 2026-10-31 · Tests run: `npm test -- -t "ST-103"` → 9 passed; `vitest run legal-markdown.test.ts change-legal-texts.test.ts` → 34 passed; `check-scenarios.ts ST-103` → 9/9 covered; reported `verify.ts --e2e` green · Preview: none (not yet built; checked against tests and code)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Visitors read the privacy notice … in their language | legal-texts.integration.test.ts | Saved through the form runner (CRLF as sent); the legal page is rendered for "de" and "en" and the HTML is compared literally (h2, strong, list, https link); the English h1 is checked; the journal names the texts and the actor and holds no text | passed |
| An imprint in German only is offered in both languages | same | Only imprintDe is saved; welcome page "en" and "de" and the legal page carry the /impressum link; the English page shows the German imprint | passed |
| Without an imprint none is offered | same | Both imprints are given first, then emptied (the English one is "\n"); no link on the welcome page or the privacy notice in either language; the imprint page is undefined (page calls notFound) | passed |
| Before any change the placeholder … | same | Settings page rendered from defaults; PLATZHALTER / PLACEHOLDER in the text areas, imprints empty, the section is the page's last h2; visitors see the placeholder and no imprint | passed |
| An emptied German privacy notice is rejected | same | Error code, label, aria-invalid, reason placed at the field, typed imprint kept, stored settings equal to before | passed |
| An English imprint without a German one is rejected | same | Same pattern; typed text kept; no imprint offered to visitors | passed |
| Markdown outside the shown elements … | same (+ legal-markdown.test.ts) | The save succeeds, the stored text equals the typed text, the form shows it escaped, the four sources appear as text, and no script, img, table or any `<a>` remains | passed |
| Legal texts changed by someone else meanwhile … | same | Eva saves, Tom sends the old version; message, kept imprint, and Eva's notice intact | passed |
| A change to another part meanwhile … | same | The museum name changes through the real museum command; the legal texts still save; the name is kept; the confirmation is shown | passed |

Extra tests: saving without a change records nothing (HS-27); a helper is refused (G11).

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| ADR 0013 rendering | yes | `legal-markdown.tsx`: markdown-it, html false, linkify off, table/blockquote/code/fence/hr/backticks/strikethrough off, image kept as text, validateLink https/mailto, headings shifted; the single `dangerouslySetInnerHTML`; ADR status accepted | yes |
| Photo notice without its marker | yes | `reportForm.photo.notice` de/en no longer carries PLATZHALTER/PLACEHOLDER (grep of `src/platform/messages` finds none); notice kept in the catalogs | yes |
| Legal texts out of the visitor catalogs | yes | Diff removes the privacy notice from visitor.de/en; defaults live in `default-legal-texts.ts` | yes |
| 360 px | yes | e2e checks the form on a phone; text areas span the column | yes (e2e green per the caller, not re-run) |
| Journal entry, no personal data/texts | yes | changedTexts and actor only; asserted | yes |
| Texts from the message catalogs | yes | `team/collection.ts` | yes |
| `/security-review` and normal review lane | yes | Not part of this acceptance check; the caller must make sure they ran | open (process) |
| Preview check | – | The preview URL was not known | remark |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Very long legal text | No max-length rule (memory: not raised) | none |
| Uppercase `HTTPS:` or `MailTo:` link | The renderer's regex is case-insensitive, so it is shown as a link | question – harmless |
| Link to `https` opens in the same tab, with no rel attribute | Not specified | question |
| A technician's page for an imprint-less museum: the German-only imprint on an English visitor page appears in German with no notice | Specified (the German text is shown where no English one exists) | none |
| Nested/malformed Markdown, such as `![x](https://…)`, shown as source | Covered by renderer tests | none |

## Verdict
accepted with remarks – all 9 scenarios have honest tests that pass; the definition of done is met. Remarks: the preview was not checked, and `/security-review` plus the code review (normal lane) are outside this check.
