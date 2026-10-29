# Code review – ST-090: Dark design on every page, with a switch to light per device
Base: main · Commits: 9 · Date: 2026-10-29

Scope checked: `git diff main...HEAD` (18 files), the context pack, the engineering conventions incl. the two new
paragraphs "The design of a page" and "Every fold is a native `<details>` …", `check-language.ts` (no warning in the
diff's files; the 16 warnings are older), `src/app/design.test.ts` (18 passed).

What holds up: the design is one pure rule of the path (`designOf`), decided on the server before the page is sent, with
no inline script (ST-070's CSP is unchanged). The proxy always overwrites `PAGE_PATH_HEADER`, so a client-sent header
never reaches the layout. The switch is a plain form posting to a Server Action under the proxy's Origin check. `back`
goes through `sameSitePath` (no open redirect). The cookie is `httpOnly`, `lax` and holds only `dark`/`light`
(`deviceDesign` rejects anything else). `color-scheme` follows the `.dark` class, and `prefers-color-scheme` appears
nowhere. The only colour of its own is the printed `text-black` of the sticker sheet, which the convention allows. All
three folds use `summary.fold`. Every one of the 11 scenarios has a test with its exact title, and each test checks its
"Then" through the computed colour scheme, as the lead dev decided. No events, commands or read models are involved, so
ADR-0002 command-layer rules do not apply. The switch changes only the browser's cookie, like the visitor language switch.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Design / smells | `src/app/(team)/layout.tsx:9`, `src/app/layout.tsx:23` | The device's choice is read from the cookie in two places, and the team layout repeats the "dark without a choice" default (`?? "dark"`) that `designOf` already owns. If the default ever changes, the „Mehr“ label and the page's design can disagree. | Duplicated Code; locality (codebase-design); convention "one pure rule … `designOf`" | Let `design.ts` own both parts: e.g. `deviceChoice(cookieStore)` for the read, and have the team layout ask `designOf("/team", device)` (or a named `teamDesign(device)`), so the default lives only in `designOf`. |
| 2 | minor | Design | `src/app/(team)/navigation.tsx:75-77` | "The other design" is computed twice inline (`design === "dark" ? "light" : "dark"`), once for `to` and once for the label. `DesignSwitch` is shallow: the caller has to know both the target and its label. | Duplicated Code; shallow module (codebase-design) | Pass the current design only (`<DesignSwitch current={design} />`) and let `DesignSwitch` derive the target and its label from `team.switchTo`. Alternatively export `otherDesign(design)` from `design.ts`. |
| 3 | minor | Design / conventions | `src/app/design.ts:24`, `src/app/(print)/layout.tsx` | The light print design is tied to one path (`/team/machines/stickers/print`), while the convention speaks of route groups and the pages made for printing live in the route group `(print)`. A second page added to `(print)` would silently follow the device's choice. The table test would not catch it, because nobody would add a row. | Shotgun Surgery risk; convention "A new route group decides its design in `designOf`" | Add one sentence to the `(print)` layout's doc comment: a page added here needs its own light row in `designOf` and in `design.test.ts`. Alternatively widen the rule to every print page under `/team`. No code restructure is needed. |
| 4 | minor | Language | `src/app/design.ts:11,18,23`, `src/app/layout.tsx:23`, `e2e/dark-design.spec.ts:30` | "device" (`deviceDesign`, `device`, `anotherDevice`) is an `_Avoid_` word of **Machine** in `CONTEXT.md`. Here it means the team member's phone or PC, as the story uses it, and the language check does not flag it. Still, the meaning collides with the glossary. | `CONTEXT.md` Machine `_Avoid_`; CLAUDE.md "New term → add it to `CONTEXT.md` first" | Add a short glossary note: "device – the browser on a phone or PC (a design choice belongs to it), never a machine". Then the term is decided, not guessed. Keep the names. |
| 5 | minor | Conventions | `.claude/skills/engineering-conventions/SKILL.md:627` | The sentence "Not every Server Action goes through `formAction`: this one runs no command. Every other write still does." is now wrong twice: `switchDesign`, like the older `switchVisitorLanguage`, is a write that bypasses `formAction`. A later reader could treat the design switch as a violation. | Convention accuracy (the PR adds the convention paragraph) | Reword the line: "… Every other write still does, except the browser-cookie switches (visitor language ST-010, design ST-090), which set only a cookie and redirect." |
| 6 | minor | Test quality | `e2e/dark-design.spec.ts:24-27` | The test helper `designOf` has the same name as the domain rule `designOf` in `src/app/design.ts`, but it reads the computed `color-scheme`. It also tells a Page from a Locator by duck-typing (`"evaluate" in target && "goto" in target`) and then casts. | Mysterious Name | Rename it to `colourSchemeOf` and split it into `pageColourScheme(page)` and `colourSchemeOf(locator)`, or always pass a locator (`page.locator("html")`). That removes the type sniffing and the cast. |
| 7 | minor | Smells (no action now) | `src/app/(team)/design-action.ts`, `src/app/visitor-language-action.ts` | Both are "remember a browser preference in a cookie, then redirect to `sameSitePath(back)`". There are two instances, and the cookie lifetimes differ for no stated reason (400 days vs one year). | Duplicated Code (rule of three, not reached) | Leave as is. If a third preference switch appears, extract `rememberOnDevice(cookie, value, back)`. Optionally align the lifetimes now with one constant. |

Notes, no finding:
- "Native controls follow the design" does not physically open the choice list. It checks the computed colour scheme
  and background of an `<option>` against the page. This matches the lead dev's yardstick ("computed colour scheme, not
  pixels") and is accepted.
- `switchDesign` has no `requireTeamMember()`. Anyone may post it, but it only sets the poster's own cookie and the
  redirect is same-site, so there is no authorization concern.

Verdict: ready to merge
Most important: #1, where the "dark without a choice" default is duplicated in the team layout outside `designOf`, so the „Mehr“ label and the page's design can disagree if the rule changes.

## Refactor (2026-10-29, `/implement`)

Fixed in this story:
- **#1** the cookie is read in one place, `src/app/current-design.ts` (`currentDeviceDesign`, `currentTeamDesign` = `designOf("/team", …)`); the team layout no longer repeats the default.
- **#2** `DesignSwitch` takes the current design and the labels and derives the target once.
- **#3** the `(print)` layout's comment says a new print page adds its path to the light row of `designOf`.
- **#4** `CONTEXT.md`, *Machine*: a note that "device" means only the browser on a phone or PC (ST-090).
- **#5** the conventions line on Server Actions outside `formAction` names the two cookie switches.
- **#6** the browser test's helpers are `schemeOfPage` and `schemeOf` – no duck typing, no clash with `designOf`.
- Acceptance remark 2 / `/code-review`: „Every fold looks the same“ also compares a group of G27 (the machines of a new maintenance task) with „Mehr“, closed and open, in both designs.
- `/code-review`: the fold marker has a plain `content` before the one with alternative text (older browsers); the switch redirects with `RedirectType.replace`, so switching adds no step to the history.
- Found while refactoring: Prettier's Tailwind plugin trimmed the space in `" dark"` on `<html>` – the class is built with `cn` now (the browser test caught it).

Skipped:
- **#7** one cookie-and-redirect pattern for both switches – two instances, no extraction yet; the lifetimes stay (visitor language one year, design 400 days, the longest a browser keeps a cookie).
- `/code-review`: two writers of the `<html>` class (React's prop, `DesignFollowsPage`) – both apply `designOf` to the current path; React only rewrites the class when a server render for the current path changes it, so they cannot disagree.
- `/code-review`: a second open tab keeps the old device choice until it loads a page anew – accepted, the switch is per device, not live across tabs.
- `/code-review`: `useSearchParams` without a Suspense boundary – every page is rendered per request (`connection()` in the root layout, ST-070); revisit only if static rendering ever returns.
- `/code-review`: `switchDesign` checks no session – it sets only the caller's own cookie, like the visitor language switch; no data, no command (security review: no finding).
