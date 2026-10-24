# Code review – ST-050: Dashboards mark what is new since the last visit
Base: main · Commits: 11 · Date: 2026-10-24

Checked: `git diff main...HEAD`, the context pack, ADR 0011 (and 0002/0004), `CONTEXT.md`, `docs/architecture/data-model.md`, the engineering conventions. The user's test plan decisions of 2026-10-24 (what is marked, the texts, the dedicated `dashboard_visit` table with a conditional write, not journaled, no AGG-ID) are treated as given. `check-language.ts` reports no new warnings (all 14 predate this branch). The story's unit and integration tests pass (6 files, 50 tests); the browser tests were not run.

What holds: the Last visit is written only by the client effect's Server Action, never in the render (ADR 0011); the dashboards compute their mark line purely with `decideVisit` through `lastVisitOf`; the actor comes from `currentPerson()` and the action takes no input; own actions are excluded by actor ID (triage reporter, status change, resolved/reopened; the helper's changes are already filtered by `notBy` in `changesOnClaimedDefects`); the Team module is reached only through its `index.ts`; `openSince` is the defect's `recordedAt`, so section 2 marks "recorded since" as the user decided; the conditional `UPDATE … WHERE current_visit_started_at = <read>` and `onConflictDoNothing` do make two tabs opening at once idempotent.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | major | Test quality | `src/app/(team)/team/technician-dashboard-new.integration.test.ts:208` | The test for "An action on the dashboard does not end the visit" cannot catch the bug the scenario and ADR 0011 guard against: the page render writing the visit. Both the re-render (12:05) and the return (12:10) fall within the hour of the 12:00 open, so `decideVisit` changes nothing even if `loadTechnicianDashboard` called `recordVisit` itself. No test anywhere shows that a render without the client effect leaves the stored visit alone. That property is the whole point of ADR 0011 ("should stay true"). | tdd: a scenario test that doesn't check what the scenario protects against; ADR 0011 Decision/Consequences | Add a case that would fail with a write in the render. Open at 12:00, Ben changes something at 13:00, render only at 13:30 (prefetch or re-render, no `recordVisit`), then open at 14:45. Ben's 13:00 change must still be marked: the Last visit stays 12:00, while a write in the render would have moved it to 13:30. |
| 2 | major | Conventions | `src/app/(team)/team/visit-actions.ts:12`; `.claude/skills/engineering-conventions/SKILL.md:596`, `:350` | `recordVisitAction` is a Server Action that doesn't use `formAction`, and `recordVisit` writes state outside `aggregateCommand`/the journal. ADR 0011 allows both, but the conventions still say "Server Actions only through `formAction`" and "every command … journals at least one event". The checklist and the next reviewer will flag it, or the next story will copy it without the ADR's reasoning. The ADR's Open Point (aggregateStore vs. a dedicated table) was settled by the user (decision 3), but that is written down nowhere in the repo. | engineering-conventions (checklist, *Server Actions and forms*); ADR 0011 Open Points | Add a short "non-journaled per-member state" exception to the conventions, next to the login/account exception at `:350`: who may write it this way (ADR 0011 only), the dedicated table with a conditional write, and the client-effect Server Action without a runner. The user approves the change. |
| 3 | minor | Conventions / security | `src/app/(team)/team/visit-actions.ts:13-14` | The action checks `person.kind !== "team-member"` itself instead of calling `requireTeamMember()`, as "every team Server Action" should. This is safe today: no session gives a visitor and returns, and a deactivated account is redirected by `currentPerson()`. But it is the one team action with its own check. | engineering-conventions `:518`, `:377` | Call `requireTeamMember()` and use its ID, or name this exception in the convention from #2. |
| 4 | minor | Domain docs | `docs/architecture/data-model.md:400` | The data model still lists one optional `Last visit` timestamp on the Team member. The code keeps two values in the new `dashboard_visit` table (`current_visit_started_at`, `last_visit`). | CLAUDE.md sources of truth (logical data model) | The domain-architect updates the Team member section: the dashboard visit with when the current visit began and the Last visit, one row per team member, not journaled (ADR 0011). |
| 5 | minor | Language | `src/modules/team/visit.ts:3-13`, `visits.ts` | The code introduces a domain notion, the *current visit* ("round", which lasts while the dashboard is opened again within an hour of its beginning). Decision 2 and ADR 0011 rely on it, but `CONTEXT.md` defines only *Last visit*, and that definition ("the moment a team member last opened their dashboard") no longer matches exactly: it is now the beginning of the previous visit. | CLAUDE.md: new term → `CONTEXT.md` first | Sharpen *Last visit* and add *Visit* (one round on the floor, up to an hour after it began, decision 2) to the glossary. Names in the code can stay. |
| 6 | minor | Scenario edge / design | `src/modules/team/visits.ts:168-170` (`lastVisitOf`) | Because the mark line is computed purely from `now`, a re-render after an action taken more than an hour after the dashboard was opened (the page left open on the workshop PC) drops the marks, although no visit was recorded. This is the ADR's deliberate choice (it matches what the next open would show), but it only partly meets the story's "a re-render after an action taken on it is not a visit", and nothing records it. | ADR 0011 *Where the display gets its mark line*; ST-050 Context | Accept it as the ADR's consequence. If the user wants it written down, add one line to `OPEN_QUESTIONS.md` or to the ADR's successor. Don't change it in code. |
| 7 | minor | UI text | `src/app/(team)/team/technician-dashboard.tsx:177`; `src/platform/messages/team/dashboard.ts:49` | Section 5 now reaches back to the Last visit when that is older than 7 days, but the empty state still says „Keine Änderungen in den letzten 7 Tagen.“, which is wrong when the window was longer. | ST-050 Context (reach back); G7 | Use an empty text that is true for both windows, or pass the window to the text. Confirm the wording with the user. |
| 8 | minor | UI | `src/app/(team)/team/new-mark.tsx:7` | The marker is a `<strong>` styled `font-medium` (weight 500), so it renders medium, not bold. Decision 2 at the test plan checkpoint says "in bold". | User decision 2 (2026-10-24) | Drop `font-medium` (or use `font-semibold`/`font-bold`), unless the ux-designer wants medium to match the count line. |
| 9 | minor | Time convention | `src/app/(team)/team/technician-dashboard-data.ts:86` | "The earlier of 7 days ago and the Last visit" is built inline with `new Date(Math.min(…getTime()))`. This is not `new Date()` for "now", but it is instant arithmetic outside `src/platform/time.ts`. | engineering-conventions *Time and time-based rules* | Optional: a small `earlierOf(a, b)` helper in `time.ts`, or leave it. |
| 10 | minor | Test quality | `src/platform/no-notifications.test.ts:21` | The `mailto:` pattern doesn't look for a way to *send* a notification. It will fail on a legitimate contact link, e.g. a museum e-mail address on `/impressum` (ST-064 legal pages). | Speculative breadth of a repository scan | Drop `mailto:` and keep `sendMail(` and `smtp://`. |
| 11 | minor | Test quality | `e2e/helper-dashboard.spec.ts:37` | The test waits for `networkidle` until the client effect has recorded the visit. Playwright discourages this, and it is an indirect signal: if the action is slow, the next step races. | Browser-test robustness (conventions: tests must also run on the preview) | Wait for the Server Action's POST response (`page.waitForResponse` on a POST to `/team`) instead. |

ready to merge
Most important: #1, the test for "An action on the dashboard does not end the visit" would still pass if the render wrote the Last visit, so ADR 0011's central guarantee is unguarded. A 15-minute test fixes it. None of the findings meets the follow-up hurdle.

## Resolution (implementer, 2026-10-24)

| # | Outcome |
|---|---|
| 1 | fixed – new test "a render that is no visit … does not move the Last visit (ADR 0011)"; it fails when the render records the visit (mutation checked) |
| 2 | fixed – section *The Last visit* in the engineering conventions, the checklist line names the exception; **awaits the user's approval** at acceptance |
| 3 | skipped – the action takes no input and acts only for the session's team member; a visitor's or deactivated account's call records nothing (security review: no findings). The convention from #2 names it |
| 4, 5 | fixed by the domain-architect (`docs/architecture/data-model.md`, `CONTEXT.md`) |
| 6 | accepted as ADR 0011's consequence – no change |
| 7 | fixed – „Keine Änderungen seit deinem letzten Besuch.“ when section 5 reaches back to the Last visit |
| 8 | fixed – plain `<strong>` (bold) |
| 9 | fixed – `earlierOf` in `src/platform/time.ts`, with a table test |
| 10 | fixed – `mailto:` dropped from the scan |
| 11 | fixed – the browser test waits for the recorder's POST to `/team` |

### `/code-review` (medium), same day

| Finding | Outcome |
|---|---|
| Render and effect read the clock separately – near the one-hour boundary marks seen and visit recorded can differ by seconds | skipped minor – passing the render's time would mean an input from the browser; the window is seconds |
| A new visit's Last visit is where the previous visit began, so entries of the previous visit are marked once more | no change – ADR 0011 and decision 2 as accepted |
| Section 5 has no upper bound after a long absence | skipped minor – ~60 machines; revisit when a dashboard load gets slow |
| Empty text of section 5 | fixed (#7 above) |
| `void recordVisitAction()` leaves a rejection unhandled | fixed – caught; a failed recording keeps the previous Last visit |
| `lastVisitOf` awaited before the other queries | fixed on the helper dashboard (in the `Promise.all`); the technician dashboard needs it for the window first |
| Reopened or newly suitable defects, maintenance and stale claims are not marked | no change – the user's decision 1a at the test plan checkpoint (2026-10-24) |
| `<VisitRecorder />` in both branches | fixed – one `Page`, one recorder |

### Found while fixing

Every dashboard open renders the dashboard a second time: the recorder's Server Action gets the proxy's renewed session
cookie, and a cookie change makes Next.js re-render the route in the action's response (engineering conventions,
*Server Actions and forms*). Navigating away before that response ends shows as `aborted` / `ECONNRESET` in the server
log (seen in the local browser tests; none without the recorder). Harmless for the marks; named for the user at acceptance.
