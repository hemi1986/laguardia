# Story Review – 2026-09-26

Scope: ST-001 … ST-051 (all `status: review`). Reviewers: `product-owner` (value, scope, priority) and `lead-dev` (size, risk, split, technical findings), run in parallel. Nothing has been applied yet – every change below needs the user's consent (see [Decisions](#decisions)).

## Summary

- **PO:** backlog in good shape; all commands and read models covered, no non-goal violated, glossary used correctly. 34 × approve, 17 × approve with changes, 0 × rework. The MVP closes the core loop (report → triage → repair → playable again) end to end. Weak spots: goal 3 (no overview by machine status), goal 5 (maintenance records visible nowhere in the MVP without ST-047).
- **Lead dev:** Gherkin is behavioural and testable almost 1:1. No XL; three L stories must be split (ST-030, ST-039, ST-043), three should be (ST-023, ST-037, ST-048). Main risks: undefined time semantics (timezone, "days", 25 % of a month), gaps in the due calculation for new/returning machines, races around retirement and museum numbers, the public surface (rate limit on shared Wi-Fi, anonymous uploads, caching, file serving), auth library choice, private storage reads and storage backups, and a missing engineering foundation (CI, environments, monitoring, custom domain, legal pages).
- **PO and lead dev agree** on: ST-031, ST-034, ST-036 are cheap and valuable for go-live (typos, moved machines); ST-014 "per client" does not work on shared museum Wi-Fi; ST-017 lacks the helper scenario; ST-050 is the vision's notification replacement but outside the MVP (acceptable).

## Per story

Sizes: XS ≈ ½ day, S ≈ 1 day, M ≈ 2–3 days, L ≈ 1 week (split), XL > 1 week – relative, for one part-time developer.

| ID | PO verdict | PO prio | Size | Risk | Split | Key findings (PO / lead dev) |
|---|---|---|---|---|---|---|
| ST-001 | approve | must | M (2 d) | high | – | LD: add private **reads** from storage, separate preview/prod DB and secrets, migrations in build/CI, test 100 MB upload, skeleton code is kept. Plan/cost/DPA research can be done by the user in parallel. |
| ST-002 | approve | must | M (2 d) | high | – | LD: timebox 1 → 2 days; EXIF rotation before stripping, HEIC, server re-encoding within limits, photos through the server (not direct), stub login for the team-only check. |
| ST-003 | approve | must | M | medium | – | LD: injectable clock + timezone, "system" actor for policies, version check for every triage command, security headers/CSRF. CI → TT-A. |
| ST-004 | approve w/ changes | must | M | medium | – | PO: scenario for session expiry after 90 days. LD: auth library check (SP-3), min password length ≥ 10, secure cookies, role re-read per request, first-technician setup as CLI script; per-username lock-out is a conscious risk. |
| ST-005 | approve | must | M | low | optional | LD: concurrent mutual demotion of the last technicians; same password rule. |
| ST-006 | approve | must | S | low | – | Optional year range check. Duplicate models (same title + manufacturer) only if the team sees a risk. |
| ST-007 | approve | must | M | medium | – | LD: concurrent auto-assignment retries (LG-042 → LG-043); reserved numbers count for uniqueness and "next above highest"; behaviour after LG-999. |
| ST-008 | approve w/ changes | must | S | low | – | PO: goal 3 needs a filter by machine status or counts per status. LD: sort by museum number. |
| ST-009 | approve | must | S | low | – | Retired scenario via test data; times in Europe/Berlin. |
| ST-010 | approve | must | M | medium | – | LD: never shared-cached; no names or internal IDs in page source; language choice persisted. |
| ST-011 | approve w/ changes | must | M | medium | – | PO: short DE/EN prompt on the sticker ("Problem? Scan me"). LD: final custom domain before printing (TT-C); no shared cache; automatable test ("QR decodes to address"); label product to be named. |
| ST-012 | approve | must | S | low | – | "Only when unsafe" is trust, not a checkable rule – keep as context. |
| ST-013 | approve | must | M | medium | – | LD: no hint at 0 reports, singular for 1; CSRF; output encoding of report text. |
| ST-014 | approve w/ changes | must | M | medium | – | **PO + LD:** "per client" ≠ per IP (shared Wi-Fi). LD: counters in the DB; hashed identifiers, kept only for the window. |
| ST-015 | approve | must | S | low | – | Clean. |
| ST-016 | approve | must | M | high | – | LD: owns photo display in triage list + defect detail → add ST-017, ST-021 to `depends_on`; concrete size limit before ready; failed upload keeps the typed description. |
| ST-017 | approve w/ changes | must | S | low | – | **PO + LD:** add helper scenario (only resolve on the spot). LD: move photo display to ST-016; "longer than 3 days" = > 72 h. |
| ST-018 | approve w/ changes | must | M | medium | – | PO: status change in the same step offers only Limited / Out of order. LD: real race test (HS-16); rejected status change rolls back the defect. |
| ST-019 | approve | must | S | low | – | Same version check as ST-018. |
| ST-020 | approve | must | S | low | – | LD: delete spam photo after commit, log failures; acceptable CDN delay. |
| ST-021 | approve w/ changes | must | M | low | – | PO: order within a priority (oldest first); defect details show all work log entries and linked problem reports. |
| ST-022 | approve | must | S | low | – | LD: add ST-021 to `depends_on`. PO optional: visitor count drops after linking. |
| ST-023 | approve w/ changes | must | L | medium | **yes** | PO: contradiction – story says technician, scenarios are about helpers; outcome is mandatory for technicians. LD split: (a) technician reports + records defect incl. status; (b) report + link / resolve on the spot incl. helper variant. |
| ST-024 | approve w/ changes | must | S | low | – | PO: logging work on a defect on hold does not resume it; details show all entries, newest first. |
| ST-025 | approve | must | S | low | – | LD: simultaneous claims → version check rejects the second ("reload"). |
| ST-026 | approve | must | S | low | – | Clean. |
| ST-027 | approve | must | XS | low | – | Clean. |
| ST-028 | approve | must | S | low | – | Clean. |
| ST-029 | approve w/ changes | must | S | low | – | PO: "As a team member" (the claimant may be a helper). |
| ST-030 | approve w/ changes | must | L | medium | **yes** | PO: link + status change in the same step; helpers cannot change status when reopening. LD split: (a) manual reopen incl. status; (b) link reopens via policy + 30-day window. Status history reason = the defect. |
| ST-031 | approve | should → **MVP?** | S | low | – | **PO + LD:** a bad title stays on the public visitor page without it – consider MVP. |
| ST-032 | approve | should | S | low | – | LD: max 5 photos per entry. |
| ST-033 | approve w/ changes | must | M | low | – | PO: defects closed on retirement shown as such. LD: "under a minute" as automatable criterion (QR address opens status + history directly, < 2 s with 5 years of data); "photos, if any". |
| ST-034 | approve | should → **MVP?** | XS | low | – | **PO + LD:** location feeds the helpers' maintenance rounds; can't be changed in the MVP otherwise. |
| ST-035 | approve | could | M | medium | – | LD: old numbers keep resolving; same uniqueness set as ST-007; race with registration. |
| ST-036 | approve w/ changes | should → **MVP?** | XS | low | – | PO: scenario that a category/technology correction changes applicable tasks, records kept. LD: go-live typos likely – consider MVP. |
| ST-037 | approve | must | L | medium | **yes** | LD split: (a) attach file ≤ 100 MB to machine/model, grouped by category; (b) camera photo as *Photo* file. Files team-only; non-PDF/non-image always downloaded; orphaned uploads. |
| ST-038 | approve | should | S | low | – | Deletion is permanent (no storage backup) – confirmation step. |
| ST-039 | approve | must | L | medium | **yes** | LD split: (a) retire + policies + guards; (b) retired machines in views. Race: a report/defect/record created at the moment of retirement is rejected or closed. |
| ST-040 | approve w/ changes | must | S | low | – | PO: "instruction is required" scenario. LD: month-end arithmetic via time convention. |
| ST-041 | approve w/ changes | should | S | low | – | PO: changed restriction removes a machine from the due list; can the start date be changed? |
| ST-042 | approve | must | S (XS as checklist) | low | – | **Conflict:** PO keeps the seed task (and asks about back-dated records); LD proposes technicians enter the 19 tasks via ST-040 → ST-042 becomes a go-live checklist item. |
| ST-043 | approve w/ changes | must | L | high | **yes** | PO: filter "suitable for helpers" (ST-049 not in MVP); sort by location. LD: highest-risk story – split (a) list, restrictions, start date/last done, overdue rule; (b) Not on display suspension + return rule. Needs time convention and due rules for new/returning machines. |
| ST-044 | approve w/ changes | must | S | low | – | PO: recording a task that is not due restarts the interval; recording possible from the machine record; date rule (back-dating?). |
| ST-045 | approve w/ changes | must | M | low | – | **PO contradiction:** selection happens "in the due list", but the scenario selects a machine that is not due – selection must cover all machines the task applies to. LD: one transaction per machine. |
| ST-046 | approve | could | XS | low | – | PO: could later merge into ST-044. |
| ST-047 | approve w/ changes | should → **must (a)** | S | low | **yes (PO)** | PO: (a) maintenance records, due/overdue and recording on the machine record → MVP; (b) overdue count in machine overview → should. |
| ST-048 | approve w/ changes | must | L | medium | **yes** | PO: "stale claim" not in `CONTEXT.md`. LD: add ST-024 to `depends_on`; split (a) untriaged reports + machines without open defects; (b) status changes, resolved/reopened, stale claims, overdue maintenance. |
| ST-049 | approve | should | M | low | – | LD: list which changes count; how long taken-over defects stay listed. |
| ST-050 | approve | should | M | medium | – | "Previous visit" = the visit before the current page load; shared across devices. |
| ST-051 | approve w/ changes | should | M | medium | – | PO: must be ready before the trial is evaluated; show both times per defect in defect details. LD: current priority, days with one decimal, median rule, period rule; `depends_on` ST-022/024/028 instead of ST-039. |

### `depends_on` corrections (lead dev)
ST-016 + ST-017, ST-021 · ST-022 + ST-021 · ST-048 + ST-024 · ST-011 + TT-C · ST-003 + TT-A · optional: ST-024/ST-027 + ST-028, ST-042 → ST-040, ST-051 → ST-022/024/028.

## Proposed new items

| # | Type | Proposal | Size | Before | Source |
|---|---|---|---|---|---|
| TT-A | tech-task | CI and test harness: lint, type check, unit + integration tests against real PostgreSQL, phone-size browser tests; red build blocks deploy; test-data builders; injectable clock | M | ST-003 | LD |
| TT-B | tech-task | Time convention helper (Europe/Berlin, elapsed hours, month arithmetic, 25 % rule) with a table of test cases – or fold into ST-003 | XS | ST-017, ST-043 | LD |
| TT-C | tech-task | Custom domain + stable QR address scheme (e.g. `/m/LG-042`) before any sticker is printed | XS | ST-011 | LD |
| TT-D | tech-task | Environments & operations: separate preview/prod DB and storage, secrets per environment, error monitoring, uptime check | S | go-live | LD |
| TT-E | tech-task | Backup & restore: one test restore of the DB, backup for object storage, recovery steps | S | go-live | LD |
| TT-F | tech-task | Dependency & security routine: patch deadline (critical Next.js advisories within 48 h) in the Definition of Done | XS | go-live | LD |
| SP-3 | spike (½ day) | Auth library supporting username/password with server-side sessions – or fold into ST-001 | XS | ST-004 | LD |
| NEW-1 | story | Legal pages for the public visitor pages (privacy notice incl. photos and rate-limit identifiers, imprint if required), DE/EN | S | go-live | LD |
| NEW-2 | tech-task / checklist | Go-live readiness: enter ~60 machines and models (manual or one-off import), print stickers, create accounts, set maintenance start dates | S–M | go-live | PO + LD |
| DoD | Definition of Done | Phone-first down to 360 px; lists < 1 s at realistic volume; every command writes its journal entry; German UI texts from the catalog; no personal data in logs | – | all | LD |

### ADR inputs (concerns, not decisions)
- ADR 0005: private read access for storage; storage backup; orphaned direct uploads without a cron job; photos through the server vs. direct upload.
- ADR 0002: retirement guard under concurrency; museum number uniqueness set incl. reserved numbers; deleting stored content after commit.
- ADR 0004: library support for server-side sessions; lock-out risk from per-username throttling.
- ADR 0001: no shared caching for session-dependent or live pages (visitor page, QR address).

## Decisions

Decided by the user on 2026-09-27: **all D1–D15 accepted as recommended, except D3.**

- **D3 revised:** no rate limits at all in the MVP – spam is considered unlikely; dismissing as spam covers it. ST-014 moves out of the MVP (could, later) and is removed from `depends_on` of ST-016. Input validation stays (description ≤ 2000 characters, photo size limits).
- Domain changes applied by the main session: HS-20 resolution revised and new-machine rule (D5), museum number rule (D11), files team-only (D10), back-dating and selection rules on Record maintenance (D6, D8) in `docs/domain/events.yaml`; *Stale claim* and the due definition in `CONTEXT.md` (D13, D5).

Original recommendations:

| # | Question | Recommendation |
|---|---|---|
| D1 | MVP additions | Add ST-031, ST-034, ST-036, ST-047 (a) and the new items TT-A, TT-C, TT-D, TT-E, TT-F, NEW-1, NEW-2; SP-3 and TT-B folded into ST-001 / ST-003 |
| D2 | Splits | Split ST-023, ST-030, ST-037, ST-039, ST-043, ST-047, ST-048 as proposed above |
| D3 | Rate limit "per client" (ST-014) | Anonymous browser token (cookie): 3 per 10 min; plus looser IP limit 30 per 10 min; plus 10 per machine per hour |
| D4 | Time convention | Calendar logic in Europe/Berlin; waiting times as elapsed hours (> 72 h); overdue after due date + 25 % of the interval's actual days, rounded up |
| D5 | Due rules for new / returning machines (changes the HS-20 resolution) | (a) new machine or newly applying task: last done = registration / correction date; (b) on return to display the normal rule applies – only if already due at return, due since = return date |
| D6 | Back-dating maintenance records | Allowed up to 7 days in the past, default today, never in the future |
| D7 | ST-042 initial maintenance plan | Technicians enter the 19 tasks via ST-040; ST-042 becomes a go-live checklist item (XS) |
| D8 | ST-045 selection | All machines the maintenance task applies to can be selected, not only due ones |
| D9 | Custom domain for QR stickers | Register a custom domain before printing any sticker (TT-C) |
| D10 | Files and backups | Files are team-only like photos; object storage gets a periodic backup (TT-E) |
| D11 | Museum number assignment | Reserved numbers count for uniqueness and "next above highest"; after LG-999 the next free lower number |
| D12 | Spike timeboxes | ST-001 2 days, ST-002 1 → 2 days |
| D13 | "Stale claim" | Add *Stale claim* to `CONTEXT.md` (claim older than 14 days without a work log entry) |
| D14 | Sticker prompt | Short DE/EN prompt on the QR sticker ("Problem? Scan me") |
| D15 | Remaining findings | Apply all other "approve with changes" findings and `depends_on` corrections as listed, set sizes/risks from this review |

## Outcome (2026-09-27)
- Applied by `requirements-engineer`: splits ST-052–ST-058, new items ST-059–ST-064, ST-042 turned into the go-live readiness checklist (incl. the initial maintenance plan, D7), all findings, sizes, risks and priorities.
- User decisions after applying: photo limit in ST-016 (up to 20 MB accepted, stored ≤ 2048 px / ≤ 1 MB), sticker prompt "Problem? Scan mich!" / "Problem? Scan me" (ST-011), Definition of Done as a section in ST-059.
- Approved by the user: **all 64 stories set to `ready`** (54 of them labelled `mvp`).
