# Story review 2026-09-29 – ST-076, ST-077, ST-078, ST-066

`/review-stories` after ST-005 was merged. Product owner and lead dev reviewed in parallel.

Background: the user saw the merged account management, said the UI design is bad, and asked when shadcn/ui
arrives. ADR 0001 (accepted) names shadcn/ui and Tailwind v4 is installed, but shadcn was never initialised and
**no story of the 75 covered styling** – ST-001 said "no styling required" and every story since inherited it.
The user decided: build the UI foundation **before ST-006**, while only four team pages exist, and remove the
ST-001/ST-002 spike scaffolding **right away** rather than in ST-066.

## Per story

| Story | PO | Lead dev: size / risk | Conflict |
|---|---|---|---|
| **ST-076** UI foundation – shadcn/ui, phone layout, team shell, `/login` + `/team` | accept, raise to **must** | **L / medium** (drafted M) | none on content; the two differ only on how to handle the L (see decision 2) |
| **ST-077** Rebuild the account pages | accept, raise to **must** | **M / medium** (drafted S/low) | none; PO warns the interim state (styled shell around raw forms) should not sit long |
| **ST-078** Remove the spike scaffolding code | accept, raise to **must** | **S / medium** | none; both recommend option (a) of its open question (ST-073 first) |
| **ST-066** Remove the spike configuration and data | accept, raise to **must** **and treat as a go-live blocker** | **S / low**, unchanged | none |

## What both reviewers agree on

- **The slice ST-076 → ST-077 is sound.** ST-077 introduces no new component kind. After ST-076 alone a
  technician sees the new shell and navigation wrapped around still-raw account forms – not broken, but
  visually inconsistent, so ST-077 should follow close behind.
- **"The existing tests stay green" is not enough for a restyle.** It proves non-regression, not that the new
  markup is accessible. Both stories already go further (keyboard reach, focus visibility, one `<main>`,
  `scrollWidth <= 360`, unique accessible names), which is what makes them reviewable without Gherkin.
- **ST-073 before ST-078** (option (a) of ST-078's open question): let ST-073 convert the real spike form to the
  Server Action runner before ST-078 deletes it. Option (b) reopens an approved `ready` story and downgrades
  ST-073's own proof to a synthetic test stand-in, for no material speed gain.

## Findings that reach beyond the four stories

1. **Priority is the only ordering lever.** `BACKLOG.md` is generated "ordered by priority, dependencies first".
   Left at `should`, all four sort *after* ST-006 and every other `must` – the opposite of the user's decision.
   PO recommends `must` for all four on that ground, with the accessibility and compliance value as support.
2. **ST-066 is a compliance gap, not a cleanup.** Its own text says the blobs under `spike/` may show
   identifiable people and sit on the Hobby account without a DPA (ADR 0006). PO: `must`, and a go-live blocker.
3. **ST-042 (go-live readiness, `must`) depends on neither ST-066 nor ST-078** – verified:
   `depends_on: [ST-005, ST-011, ST-040, ST-043, ST-061, ST-062, ST-063, ST-064, ST-065, ST-070]`. As written,
   La Guardia could pass its go-live checklist with a password-gated test page and those blobs still live.
   PO reads this as an oversight.
4. **Duplicate acceptance criterion** – verified: ST-068 line 35 ("`e2e/report-problem.spec.ts` is removed or
   rewritten") and ST-078 line 47 ("is deleted") both claim the same deletion. ST-068 also still says the code
   removal is ST-066's job and must happen "before or together with ST-066" – stale now that ST-078 exists.
5. **The component directory needs its own boundary element** – verified against `eslint.config.mjs`: the three
   policies constrain only `module`, `platform`, `app` and `spike` as `from:`; the `shared` element
   (`src/(photo|test-support)`) has **no** disallow policy. So if `src/components/ui` were classified as
   `shared`, ST-076's own criterion ("a component that imports a module, the message catalogs or the platform is
   a lint error") would silently not be enforced. ST-076 must add a `ui` element **and** its policy.
   `src/platform/module-boundaries.test.ts` is the right seam – it is how every other boundary is proven today.
6. **ST-078 does not depend on the UI stories.** ST-073 only `depends_on: [ST-071]` and touches none of the team
   pages, so it can run in parallel with ST-076/ST-077. The build order written in ST-078 should not be read as
   a dependency.
7. **The no-JS role select may not be deliverable as written.** ST-077 requires the role select to submit
   without JavaScript. shadcn's `Select` wraps Radix, which renders a JS-driven listbox; whether its
   visually-hidden native bridge is keyboard-operable with JS off is implementation-specific. The lead dev
   explicitly refused to guess. This must be verified against the real copied component, with a plain
   Tailwind-styled native `<select>` named as the fallback – and it belongs to ST-076, which builds the
   component, not to ST-077, which only consumes it.
8. **Possible convention/ADR decision:** whether Radix-based components are allowed at all for fields that must
   submit without JavaScript, or whether the house rule is a native control for those and Radix only for
   JS-required presentation. That affects every future form, not just ST-077.
9. **Missing line in the conventions:** the stories say where components live, but not whether shared components
   get their own tests or are proven only through page-level browser tests. Worth a line in the seam catalog so
   later component additions do not improvise.

## Decisions (user, 2026-09-29)

1. **ST-073 before ST-078** – option (a). ST-073 converts the real spike form to the Server Action runner, then
   ST-078 deletes it. `depends_on: [ST-004, ST-073]` stays. ST-073 itself only depends on ST-071 and touches no
   team page, so it runs in parallel with ST-076/ST-077 and must not be blocked on them.
2. **ST-076 stays one L story** – no spike, no split; the uncertainty is carried inside it. Both concrete risks
   are written into the story: the `ui` boundary element **with its own disallow policy**, and verifying the
   select without JavaScript against the real copied component, with a plain native `<select>` as the named
   fallback for any field that must submit without JavaScript.
3. **All four housekeeping fixes applied**: priorities to `must`; ST-042 `depends_on` gains ST-066 and ST-078;
   ST-068's stale ST-066 references and its duplicate criterion corrected; the seam catalog in
   `.claude/skills/engineering-conventions/SKILL.md` gained the row for shared UI components.

Two smaller open questions were resolved so the stories could go `ready` (a story cannot be `ready` while an
`[OPEN]` remains):

- **`/` becomes a minimal placeholder page**, not a redirect – forced by the `done` scenario test
  `ST-004: Team pages require login`, which opens `/` and asserts it does *not* redirect to `/login`.
- **The team UI is light only for now**; `prefers-color-scheme` is not followed. Reversible.

## Correction: `must` does not change the backlog order

The product owner's reason for raising all four to `must` was that `BACKLOG.md` is generated in priority order.
Checked afterwards in `.claude/lib/discovery.ts`: `backlogOrder` sorts by priority **and then by story ID**,
then walks dependencies first. ST-006 and ST-076 are now both `must`, so ST-006 still comes first – it has the
lower ID – and `node .claude/skills/implement/scripts/next-story.ts` still answers `ST-006`.

So the priority change does **not** produce the intended order. `must` is still defensible on its own merits
(the app needs a usable UI for the trial; ST-066 is the ADR 0006 compliance gap), but the ordering has to come
from somewhere else. Two ways:

- name the story when starting it – `/implement ST-076` – the intended order is recorded in the stories' notes
  (chosen for now, it changes no approved story);
- or make ST-006 `depends_on: [ST-077]`, which the dependency-first walk would honour. That is a real statement
  ("machine-model pages are built on the shared components") but it edits an approved story and creates a hard
  block, so it was not done without the user asking for it.
