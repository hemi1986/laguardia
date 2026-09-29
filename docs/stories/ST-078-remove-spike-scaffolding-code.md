---
id: ST-078
title: Remove the spike scaffolding code
type: tech-task
context: BC-Repair
priority: should
size: null
risk: null
events: []
depends_on: [ST-004, ST-073]
labels: [foundation, follow-up]
status: review
---

## Task
Split out of ST-066 on 2026-09-29 by a user decision: the **code** of the ST-001 and ST-002 spikes is removed right away, not at the end of the backlog. ST-066 keeps what this task cannot do – the `SPIKE_PASSWORD` in the Vercel environments, the blobs under the `spike/` prefix and the defensive checks against leftovers in production and in preview database branches. Cross-cutting; filed under `BC-Repair` like the other foundation tasks.

The spikes (`docs/reviews/ST-001-code-review.md` finding #2, `docs/reviews/ST-002-code-review.md` finding #3) left throwaway scaffolding behind a passphrase gate. Team login (ST-004) and account management (ST-005) replaced that gate, so it is dead weight that every later story has to read around.

**Removed:**
- the passphrase gate `src/spike/*` (`access.ts`, `files.ts`, `test-machine.ts`),
- the file pages `src/app/spike/files/*` and the upload route `src/app/api/spike/upload/route.ts`,
- the photo spike page `src/app/spike/photos/*` (page, photo picker, server action),
- the test page `src/app/page.tsx` – passphrase gate, *Report problem* form for the hard-coded machine `"test-machine"`, the list of its reports and the links to the spike pages – and the parts of `src/app/actions.ts` that serve it,
- the `spike` block in `src/platform/messages/team.de.ts`,
- the browser test `e2e/report-problem.spec.ts`, which drives that page,
- the spike's traces in the repository's configuration: `SPIKE_PASSWORD` in `.env.example`, the `SPIKE_PASSWORD` environment entry in `.github/workflows/e2e-preview.yml`, the `spike` element and its rules in `eslint.config.mjs`, the spike case in `src/platform/module-boundaries.test.ts`, the spike sentence in `playwright.config.ts` and the `spike/` line in the module layout of `.claude/skills/engineering-conventions/SKILL.md`.

**Kept:** the photo building block `src/photo/*` and its tests. It is **not** spike scaffolding – ST-016, ST-032 and ST-054 build on it (`docs/architecture/photos.md`).

Two consequences are the reason this was not done earlier, and both must be handled inside this story:

1. **The CSRF proof must not be lost.** `e2e/security.spec.ts` uses `/` to prove the protection of ST-003: it forges a cross-site POST that carries a real Server Action ID, once with a foreign `Origin` and once with none, and asserts that nothing was stored. It also checks there that pages are served with the security headers. Both tests are re-pointed at a page that still has a Server Action – e.g. `/login` (public, `logInAction`) – and keep proving the same thing: the forged post is rejected and **no session is created**. This is also the browser test that still runs against the Vercel preview without any account (`e2e/team-login.spec.ts` and `e2e/team-accounts.spec.ts` skip there), so ST-059's criterion "at least one browser test runs at 360 px width against a deployed preview" keeps holding.
2. **Visitor-flow browser coverage is absent afterwards.** `e2e/report-problem.spec.ts` is the only visitor browser test and disappears with the test page. Its replacement is **ST-068** (browser test of the real visitor problem report flow), which needs ST-007 and ST-013. State it plainly: from this story until ST-068 is done, no browser test exercises a visitor reporting a problem; the flow stays covered by integration tests of `CMD-ReportProblem` only.

`e2e/team-login.spec.ts` also uses `/` – the scenario test "ST-004: Team pages require login" opens `/` as a stand-in for a public page and asserts that it does **not** redirect to `/login`. That test belongs to a `done` story and must keep passing, so whatever `/` becomes has to stay publicly reachable without a redirect (see the open question below).

## Acceptance Criteria
- [ ] The files `src/spike/*`, `src/app/spike/files/*`, `src/app/spike/photos/*` and `src/app/api/spike/upload/route.ts` no longer exist, and no file under `src/`, `e2e/`, `scripts/` or the repository's configuration references `test-machine`, `SPIKE_PASSWORD`, `@/spike/`, `/spike/` or the `spike` message block – an automated check in `npm run verify` (or a test) fails when such a reference is added again.
- [ ] `/` no longer shows the passphrase gate, the *Report problem* form for `"test-machine"`, the list of its problem reports or the links "Dateien (Spike)" and "Fotos (Spike)"; `/spike`, `/spike/files`, `/spike/photos`, `/api/spike` and `/api/spike/upload` return 404 on the branch's preview deployment.
- [ ] `/` is publicly reachable without a redirect, so the scenario test "ST-004: Team pages require login" (`e2e/team-login.spec.ts`) stays green unchanged – what `/` shows is decided by the open question below.
- [ ] The photo building block `src/photo/*` still exists unchanged and its tests pass.
- [ ] The `spike` block is gone from `src/platform/messages/team.de.ts` and the message catalog test still passes (no key without a use, no term missing).
- [ ] `e2e/security.spec.ts` proves the same protection on a page that still has a Server Action (e.g. `/login`): a forged cross-site POST carrying that page's Server Action ID – once with a foreign `Origin`, once with no `Origin` – is rejected with a status of 400 or more, sets no session cookie, and afterwards `/team` still redirects to `/login` (no session was created). Both variants stay, and the test needs no account and no secret other than `VERCEL_AUTOMATION_BYPASS_SECRET`.
- [ ] The "pages are served with the security headers" test of the same file asserts the same headers on that page and is green against the preview.
- [ ] `e2e/security.spec.ts` runs against the commit's Vercel preview in `.github/workflows/e2e-preview.yml` without `SPIKE_PASSWORD` and is green there; the run is linked as evidence.
- [ ] `e2e/report-problem.spec.ts` is deleted, and the story's pull request states that no browser test covers the visitor problem report flow until ST-068 (which needs ST-007 and ST-013); the same sentence is recorded in ST-068 so the gap is visible where it is closed.
- [ ] The import rules still hold without the `spike` element: `eslint.config.mjs` and `src/platform/module-boundaries.test.ts` keep proving "the platform must not depend on modules or the app" and "a module must not depend on the app" with cases that do not use spike code, and a deliberate violation still fails the check.
- [ ] `npm run verify -- --e2e` is green, no other test is weakened or deleted, and `npm run build` succeeds without `SPIKE_PASSWORD` being set.

## Out of Scope
- Removing `SPIKE_PASSWORD` from the Vercel environments, deleting the blobs under the `spike/` prefix and the defensive checks for leftovers in production and in preview database branches (ST-066)
- The GitHub Actions secret `PREVIEW_SPIKE_PASSWORD` itself (ST-066 – this story only removes the workflow's reference to it)
- Deleting the spike `problem_report` rows and aligning the columns (ST-007 for `machine_id`, ST-004 for `reporter_team_member_id`)
- The replacement browser test of the real visitor flow (ST-068)
- Changes to the photo building block `src/photo/*` (ST-002 review findings on it are handled in ST-002 or ST-016)
- Moving hosting to the museum's Pro team (ST-065)
- Styling whatever `/` shows beyond the shared components of ST-076

## Open Questions
- [OPEN] **What does `/` show once the test page is gone?** Until the visitor machine page (ST-010) and the legal pages (ST-064) exist there is nothing to put there, but `/` must stay public and must not redirect, or the `done` scenario test "ST-004: Team pages require login" breaks. Options: (a) a minimal placeholder page with the museum's name and a link to the team login, (b) a redirect to `/login`. Recommendation: (a) – a redirect makes `/` a team page in practice and breaks the ST-004 scenario test. The user decides in the story review.
- [OPEN] **Order relative to ST-073.** ST-073 (`ready`) converts exactly this test page's form to the Server Action runner (decision Q22) and its criteria refer to `e2e/report-problem.spec.ts`; if the code is removed first, ST-073 has no form left to convert. Options: (a) run this story **after** ST-073 – order ST-076 → ST-077 → ST-073 → ST-078, still early and before ST-006 for the UI stories – so ST-073 stays exactly as approved; (b) remove the code first and let ST-073 prove the runner with its test stand-in action only, with the first real conversion in ST-007 (register a machine) – that changes an approved `ready` story. Recommendation: (a); `depends_on` already reflects it and the ST-073 entry drops if the review picks (b). The user decides in the story review.

## Notes
- Requirements engineer's estimate: **S**, risk **medium** – deleting is easy, but the story has to keep the CSRF proof intact and knowingly accepts a gap in visitor browser coverage. The lead dev sets `size` and `risk` in the story review.
- ST-068 still says "ST-066 removes that page, the password and the test machine" and ST-073 says "the spike photo page … ST-066 removes it". Both references now mean this story; they are `ready` stories, so the correction belongs in the story review.
