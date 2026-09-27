# Story review 2026-09-27 – ST-065

Reviewed: ST-065, originally `docs/stories/ST-065-retire-spike-scaffolding-and-move-to-pro-team.md`; after the split `docs/stories/ST-065-move-hosting-to-museum-pro-team.md` (part A) and `docs/stories/ST-066-remove-spike-scaffolding.md` (part B) (tech task, draft, follow-up of ST-001; sources: `docs/reviews/ST-001-code-review.md`, `docs/reviews/ST-001-acceptance.md`, `docs/adr/0006-hosting-verified-vercel-pro-neon-private-blob.md`).

## ST-065 – Retire the ST-001 spike scaffolding and move hosting to the museum's Pro team

### Product owner
- **Verdict: revise – split.** The story bundles an organisational/legal task (Pro team, DPAs) with a code cleanup; the story itself says the move "does not need ST-004", yet `depends_on: [ST-003, ST-004]` blocks it.
- **Priority:** the Pro-team/DPA part is **must** and should start now, in parallel with ST-003 – real team member accounts (names, usernames) reach the production database with ST-004/ST-005, long before visitor reports (ST-013) or go-live (ST-042); team member data is personal data too. The spike removal can stay **should**.
- Neon Auth disabling belongs to the Pro-team part (ops change, no dependency).
- Open question 1 (owner/payer): endorses the recommendation – the museum owns and pays for the Pro team; its project owner is team owner and accepts both DPAs; the developer is a deploying member. Missing fact: who the museum's project owner is.
- Open question 2 (ID type): endorses the recommendation to move the ID convention and the spike-row cleanup into ST-003.

### Lead dev
- **Size L, risk high as written → split into two tasks:**
  | Part | Size | Risk | depends_on |
  |---|---|---|---|
  | A – Move to the museum's Pro team, accept DPAs, Neon Launch plan, disable Neon Auth | S | medium (schedule risk: a non-engineering party must pay and accept the DPAs; minor risk during project transfer) | ST-001 only |
  | B – Remove the spike scaffolding (code, routes, `SPIKE_PASSWORD`, `spike/` blobs, test rows) | S | low–medium | ST-004 |
- Testability: ACs are checkable. Recommends scripting the checks for "404 on `/spike*`", "no `SPIKE_PASSWORD` in any environment" (fits ST-061's smoke/uptime tooling) and the `test-machine` row count over all Neon preview branches (Neon API) instead of manual checks. The DPA-recording AC can only be met via `OPEN_QUESTIONS.md` or a new ADR superseding ADR 0006 (ADR 0006 is accepted).
- **ID type – finer split than "all in ST-003":**
  - ST-003 gets an AC for the general convention: opaque IDs that La Guardia generates are UUIDs, created by an injected ID generator in the command layer (ST-003 has no AC on IDs today). _Note: the problem report ID in `EVT-ProblemReported` (code review finding #1) is already fixed in ST-001._
  - `machine_id`: delete the spike rows, alter the type and add the foreign key **in ST-007**, where the `machine` table is created – one atomic migration; ST-007 already reaches ST-003 via ST-006 → ST-004 → ST-003.
  - `reporter_team_member_id`: `TeamMemberId` is Better Auth's user ID; its format is only known once ST-004 wires the library in. Check Better Auth's ID format **in ST-004** and alter the column / add the foreign key there.
  - ST-065 B then keeps only a defensive check (no spike-shaped rows or columns remain).
- Ordering risks: ST-007 has no edge to ST-065 today – with the fix in ST-065, ST-007 could add the foreign key first (code review #2). Migrations run in the build; `text` → `uuid` is the first non-additive migration → write the expand/contract rule into the engineering conventions (after ST-003) **before** ST-004/ST-007 ship it.
- Open question 1: agrees; the developer should get the Member role (deploy), not owner/billing.

### Conflicts
1. **Deadline for part A:** PO – before ST-004 reaches production (team member data); lead dev – before any visitor data (ST-010/ST-014).
2. **Where the ID-type fix lives:** PO/requirements engineer – everything in ST-003; lead dev – convention in ST-003, `machine_id` migration in ST-007, `reporter_team_member_id` in ST-004 after checking Better Auth's ID format.

## Proposed changes
- Split ST-065 into **ST-065 (A, Pro team + DPAs + Neon Launch + Neon Auth off, must, depends on ST-001)** and a **new tech task (B, remove the spike scaffolding, should, depends on ST-004)**.
- ST-003: add an AC for the UUID ID convention and injected ID generator.
- ST-004 and ST-007: add the column alignment for their foreign key (per the decision on conflict 2).
- Engineering conventions (after ST-003): expand/contract rule for migrations run in the build.
- ST-061: consider the post-deploy smoke checks for removed routes and absent variables.

## Decisions (user, 2026-09-27)
1. **Split as proposed.** ST-065 becomes part A (Pro team, DPAs, Neon Launch plan with 7-day history, Neon Auth off; must; depends on ST-001). Part B (remove the spike scaffolding; should; depends on ST-004) becomes a new tech task.
2. **Deadline for part A: before visitor reports go live** (lead-dev view) – i.e. before real visitor data is stored (ST-010/ST-013/ST-014 in production). Team accounts may stay on the Hobby deployment until then.
3. **ID type split across three stories** (lead-dev view): ST-003 adds the convention (opaque IDs generated by La Guardia are UUIDs, created by an ID generator injected into the command); ST-007 deletes the spike rows, aligns `problem_report.machine_id` and adds the foreign key when it creates the `machine` table; ST-004 checks Better Auth's user ID format and aligns `problem_report.reporter_team_member_id` with its foreign key. Part B keeps only a defensive check.
4. **Open question "who owns the Pro team": the museum** owns and pays for the Vercel Pro team as data controller; the museum's project owner is team owner and accepts the Vercel and Neon/Databricks DPAs; the developer is a Member (deploy), without billing rights.
5. **Approved (user, 2026-09-27):** ST-065 and ST-066 set to `ready`; ST-066 depends on ST-004 and ST-007 (ST-007 deletes the spike rows). ST-003, ST-004 and ST-007 stay `ready` with the decided additions.
