# Code review – ST-104: AI settings – the OpenRouter key and the two models on „Einstellungen“
Base: main · Commits: 5 · Date: 2026-11-01

Scope read: `git diff main...HEAD` (41 files), the context pack, ADR 0002, 0009, 0014, `docs/engineering/conventions.md`,
the command layer (`src/platform/command/aggregate.ts`), the Server Action runner, the proxy. Ran: `npm run typecheck`
(clean), `vitest run src/modules/ai-assistance` (40 passed), `check-language.ts` (only false positives in the new code,
see #20). OpenRouter's public endpoints were queried once, read-only and without a key (`/models`, `/embeddings/models`,
`/models/{id}/endpoints`) to check the adapter's assumptions – the shapes match the fake server's fixtures; `/key` and
`/embeddings` need a key and were not checked.

Decisions of the user not re-opened: the size check only by a test embedding on saving; the embedding model only with a
key at hand; the URL `/team/museum-settings`; the command does not refuse a change of a saved part.

## 1. Review (ADRs, module boundaries, language, tests, conventions)

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Architecture | `src/modules/ai-assistance/change-ai-settings-command.ts:18`, `src/platform/command/aggregate.ts:298-305` | OpenRouter is called inside `facts`, i.e. inside the open database transaction: up to four sequential requests with a 10 s timeout each (key check, chat model, embedding model, test embedding) hold a pooled connection for up to ~40 s. On a version conflict the command layer decides again on the stored state (`decideOnStored`), which re-runs `facts` – the key is checked and a test embedding is sent a second time before the conflict is reported. Documented in the conventions, so not a violation, but it is the first command with network I/O in its transaction; ADR 0009 keeps content I/O outside it. | ADR 0002 (one transaction), ADR 0009 (I/O before the command), conventions „The AI settings“ | Acceptable at this size. **Revisit when ST-107 / ST-112** add chat completions (tens of seconds): they must not copy this pattern – ask OpenRouter before the command and pass the answers in, as ADR 0009 does with content. |
| 2 | minor | Domain rule | `src/modules/ai-assistance/change-ai-settings.ts:89-90, 96-97, 130-136` | The rule checks fail open: `chatModelRefusal(undefined)` and `embeddingModelRefusal(undefined)` accept. The decision recomputes `changedModel(...)` independently of `aiSettingsFacts`; they agree today only because both use the same function on the same state and input. If they ever drift (a refactor of `facts`, another caller of `decide`), an unchecked model is saved silently. Duplicated "what changed" logic in two places. | CMD-ChangeAiSettings rules; smell: Duplicated Code / Shotgun Surgery | Make a changed model without its fact a hard error (throw) or a rejection, so a missing check can never mean "fits". |
| 3 | minor | Domain rule | `src/modules/ai-assistance/change-ai-settings.ts:71, 171` | `aiOn` in EVT-AiSettingsChanged counts a saved key that cannot be decrypted as a key, while RM-AiSettings (`ai-settings.ts:133-146`) counts it as none – the journal can say `aiOn: true` while the form says „KI ist aus“. Harmless today, but POL-AiIndexFollowsTheSettings (ST-106) will react to "AI turned on". | Story: "A saved key that cannot be decrypted counts as no key from this story on"; data model *AI settings* | **Revisit in ST-106** (the policy) or ST-110 (which tests the undecryptable key): derive *AI on* in one place that knows whether the key is usable. |
| 4 | minor | Conventions accuracy | `docs/engineering/conventions.md:395` | "The key reaches only the facts (encrypted there)" is not true: the plain key is in `ChangeAiSettingsInput.key`, read by `decide` (`newKeyOf(input).slice(-4)`) and passed to `checkKey` / `testEmbedding`. What is true: it reaches no state, journal projection, log or page. | conventions (this branch) | Reword: "the key travels only in the command input to the facts and the decision – the state keeps it encrypted, the journal only its last four characters". |
| 5 | minor | Conventions accuracy | `docs/engineering/conventions.md:542` | The bullet still opens with "**Never declare a password (or another secret) in `fields`**" and then says the option is `secret` – which works only *for* a field declared in `fields` (`key` is declared, `ai-settings-form-input.ts:9`). Also "Only the runner's step without content has it" is enforced nowhere: `secret` sits on the shared `FormDefinition` type (`form-runner.ts:49`), and the `photos`, `logo`, `upload` and `each` steps ignore it (`form-runner.ts:315, 329, 349, 356, 372-388, 414, 432, 455`) – a future form with a photo and a secret would send the secret back. | conventions (this branch); smell: Refused Bequest | Either apply `definition.secret` in every `valuesOf` call (cheap, removes the trap) or move `secret` to the no-content definition type; reword the bullet to "declare it and list it in `secret`". |
| 6 | minor | Conventions accuracy / test quality | `docs/engineering/conventions.md:899`; `src/app/(team)/team/museum-settings/ai-settings.integration.test.ts:214`; `src/modules/ai-assistance/ai-settings.test-support.ts:20-23` | The seam row says "observed through read models and `journalOf`", but the scenario test also reads the raw row (`storedAiSettingsRow`, `SELECT * FROM ai_settings`) – a side channel. Justified here (proving the plain key is stored nowhere is not observable through any interface), but undocumented. | tdd skill (implementation-coupled), seam catalog | Keep the assertion; add "and, for the key only, the stored row" to the seam row so the exception is deliberate. |
| 7 | minor | Test quality | `src/modules/ai-assistance/ai-seam.test-support.ts:9`, `ai-settings.integration.test.ts:176-177` | The in-memory stand-in names the model "Gemini 2.5 Flash"; OpenRouter's real list names it "Google: Gemini 2.5 Flash" (checked 2026-11-01; the adapter's own fixture `openrouter.test.ts:116` already has the prefix). The scenario test asserts a list entry the real adapter never produces; in production the form shows „Google: Gemini 2.5 Flash · …“, not the story's wording. | Story, German texts (list entry); tdd skill (expected value from the real source) | Main session decides: strip the `Author: ` prefix in the adapter (anti-corruption layer) or accept the prefix and align the stand-in. |
| 8 | minor | Design | `src/modules/ai-assistance/ai-settings.ts` (whole file) | One file holds the dependency wiring (`aiDependencies`), the store, the command's facts, key usability and RM-AiSettings – four reasons to change. ST-106..110 will grow each. | codebase-design (locality); smell: Divergent Change | Name the deepening only: read model (`ai-settings-form.ts`) apart from the command's facts/store when ST-109/ST-110 touch it. |
| 9 | minor | Language | `src/modules/ai-assistance/ai-seam.ts:24, 38`, `change-ai-settings.ts:2` | `check-language.ts` warns on `ai…` (Avoid "AI" of *Chat model*) and `…Embedding…` (Avoid "Embedding" of *AI index entry*). Both are false positives: "AI" here is *AI settings*, and `TestEmbedding` / `EMBEDDING_SIZE` speak OpenRouter's language at the anti-corruption layer, not the domain's *AI index entry*. UI texts use the `_UI (de)_` words („KI“, „Chat-Modell“, „Embedding-Modell“). | CONTEXT.md | No action. |

Checked and fine: module boundaries (app imports only `@/modules/ai-assistance` and `*.test-support`; nothing imports
other modules' internals); CMD/EVT/RM IDs from `events.yaml`; command through `aggregateCommand` with `allowedActors`,
version check and journal in the same transaction; HS-27 "no change, no event"; the singleton row with a CHECK that the
last four come only with the encrypted key; every scenario has a test titled exactly as listed (two in
`e2e/settings.spec.ts`, eight in the integration test); the old ST-100 test titles stay unchanged; the conventions'
module layout line, the three seam rows (`memoryAi({ models, acceptedKeys, listsUnavailable, unreachable })`, the fake
`node:http` server, the pure encryption functions) and the „AI settings“ paragraph match the code apart from #4–#6.

## 2. Bug pass

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 10 | **major** | UI / rule | `src/app/(team)/team/museum-settings/ai-settings-form.tsx:37-42, 70, 142` | **A rejection can be invisible.** With a key saved, the key field is not shown and no `keyOffered` is posted. If the technician then saves an embedding model and the test embedding with the *saved* key comes back 401/402/403 (key revoked at OpenRouter, credits used up), the error is `ai-key-refused` → `partOf` = `"key"` → it is rendered only at the key field, which is not rendered, and `{!invalid && rejection}` suppresses it under the form. The button re-enables and nothing is said. | Story: "Every rejection names the reason at the field (G8, G9)" | Show a rejection at its field only when that field is rendered, otherwise under the form (e.g. `invalid` only if the part is shown). Add a case to the integration test. |
| 11 | **major** | OpenRouter adapter | `src/modules/ai-assistance/openrouter.ts:25, 78` | **19 models in the real list can be chosen but never saved.** OpenRouter's list contains alias IDs with a leading `~` (`~google/gemini-flash-latest`, `~anthropic/claude-sonnet-latest`, …; checked 2026-11-01), several of which read text and images and are therefore offered without „passt nicht“. `MODEL_ID` rejects the `~`, so `model()` answers "unknown" without asking and the save fails with „OpenRouter kennt dieses Modell nicht.“ – while `/models/~google/gemini-flash-latest/endpoints` answers 200. | HS-34 / story: a model not marked „passt nicht“ can be chosen | Allow an optional leading `~` in `MODEL_ID` (`~` is an unreserved URL character, no path injection) – or, if aliases are unwanted (they change the model under the museum's feet), mark them „passt nicht“ in the list. Main session decides which; add the case to `openrouter.test.ts`. |
| 12 | **major** | OpenRouter adapter | `src/modules/ai-assistance/openrouter.ts:28-31`, `ai-settings-section.tsx:11, 18-23` | Router models in the real list carry the price `"-1"` (`openrouter/auto`, `openrouter/auto-beta`, …; checked 2026-11-01). `perMillion("-1")` = −1,000,000, and `openrouter/auto` reads text and images, so the form offers it as fitting with „-1.000.000,00 $ / -1.000.000,00 $ pro Mio. Token“. | RM-AiSettings (price per million tokens) | Treat a negative price as unknown in the adapter (e.g. `pricePerMillion` optional, the entry without a price) or leave routers out / mark them „passt nicht“ (their cost and provider are not predictable). |
| 13 | minor | OpenRouter adapter | `src/modules/ai-assistance/openrouter.ts:111-113` | A 402 (no credits) from the test embedding becomes `refused` → „OpenRouter hat den Schlüssel abgelehnt“; a 400/404 – which is also what OpenRouter answers when no provider satisfies `zdr: true`, or when a provider refuses `dimensions` – becomes „OpenRouter kennt dieses Modell nicht.“ ADR 0014 calls the ZDR case *model not available*. The save is rightly rejected, only the reason is off. | ADR 0014 (anti-corruption layer turns answers into the domain's reasons) | Fine for ST-104; **revisit in ST-106/ST-107** when the domain's failure reasons for indexing and assessments are defined. |
| 14 | minor | Performance | `src/modules/ai-assistance/ai-settings.ts:127-132`, `src/app/(team)/team/museum-settings/page.tsx` | Every opening of „Einstellungen“ fetches both lists from OpenRouter (`/models` is ~800 KB, 452 models) before anything renders – the forms „Museum“, „Logo“ and „Rechtstexte“ wait for OpenRouter too, up to the 10 s timeout when it hangs. | RM-AiSettings ("read when the form is opened" – required); G16 page behaviour | Acceptable now. **Revisit in ST-110** (changing a saved model): stream the section „KI“ behind a `Suspense` boundary, so the museum forms do not wait. The 305-entry native select on a phone is ST-110's to judge as well. |

Checked and fine: the singleton is never created by the command (`NotFound` impossible after the migration); a save
without a change and „Entfernen“ without a key record nothing; the key is trimmed before check, encryption and
last-four; a refused new key stops before any model lookup; the embedding model is checked with the new key, else the
saved usable key, else rejected with „…nur mit dem API-Schlüssel prüfen…“; `withoutAiSettings` keeps the version
counting so a stale version in a test still conflicts; the migration's `INSERT` runs on preview branches copied from
production (`ai_settings` exists once there too); `?saved=ai-key-removed` is confirmed only while no key is saved.

## 3. Security pass

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 15 | minor | Encryption | `src/modules/ai-assistance/key-encryption.ts:27-28` | `createDecipheriv("aes-256-gcm", …)` without `{ authTagLength: 16 }` accepts a truncated tag (Node only warns, DEP0182), which weakens GCM's integrity to as little as 32 bits for someone who can write the row. No AAD binds the ciphertext to its row/purpose. Exploitation needs database write access and a decryption oracle – low risk, cheap hardening. | ADR 0014 (AES-256-GCM) | Pass `{ authTagLength: 16 }` to `createCipheriv` and `createDecipheriv`, reject a tag that is not 16 bytes, and use `setAAD(Buffer.from("ai_settings.encrypted_key:v1"))`. Add a truncated-tag case to `key-encryption.test.ts`. |
| 16 | minor | Adapter / configuration | `src/modules/ai-assistance/openrouter.ts:53, 58` | `OPENROUTER_BASE_URL` overrides where the key is sent, in every environment, and is listed neither in `.env.example` nor README's environment table – a value left on a Vercel environment would send the museum's key to that host. `fetch` follows redirects; undici drops `Authorization` on a cross-origin redirect, but nothing in La Guardia relies on that knowingly. | ADR 0014 (only code that talks to OpenRouter); story: key never handed out | Document `OPENROUTER_BASE_URL` as test-only (README / `e2e-server.ts` comment) or ignore it when `VERCEL_ENV === "production"`; add `redirect: "error"` to the requests that carry the key. |
| 17 | minor | Browser | `src/app/(team)/team/museum-settings/ai-settings-form.tsx:131` | `type="password"` with `autoComplete="off"`: browsers ignore `off` on password fields and offer to save the API key as this site's password – it can replace the technician's stored login password for La Guardia in the password manager. | G36 (secret only as last four) | Use `autoComplete="new-password"` plus the usual manager opt-outs (`data-1p-ignore`, `data-lpignore="true"`), or `type="text"` with `-webkit-text-security`; the main session decides. |

Checked and fine – the key never reaches:
- **form state / HTML:** `secret: ["key"]` empties it in the runner's state (`form-runner.ts:296, 480-488`); the key
  `<Input>` has no `value`/`defaultValue`; tested after a refused key and after the conflict (`value=` absent), and the
  rendered page after a save contains neither the key nor its first part (`ai-settings.integration.test.ts:197-198`).
  The no-JavaScript path serialises the same empty state.
- **journal:** the projection (`events.ts:11-20`) has changed parts, last four, model IDs, AI on – tested that the
  journal contains no part of the key; the actor is recorded by the command layer.
- **database:** only `v1:<iv>:<tag>:<ciphertext>` and the last four (CHECK constraint ties them); tested.
- **logs / errors:** no logging in the module; the adapter swallows transport errors without the key; the one thrown
  error (missing environment key, `ai-settings.ts:68-69`) names only the variable. No Sentry SDK in the code base.
- **URL:** landing is `?saved=ai` / `?saved=ai-key-removed`.
- **Encryption:** AES-256-GCM, a fresh 12-byte random IV per encryption, auth tag checked, versioned format,
  `encryptionKeyOf` accepts only canonical base64 of exactly 32 bytes; a wrong or missing environment key makes the
  saved key count as none (tested). See #15 for hardening.
- **Adapter:** model IDs reach a URL path only through the anchored `MODEL_ID` (no `/`, `?`, `#`, `%`, `..` segment),
  checked before any request and tested; a chosen ID also passes `model()` before `testEmbedding` sends it, in a JSON
  body. The regex is linear (no ReDoS). Every request has `AbortSignal.timeout(10 s)`. `Authorization: Bearer` only on
  `/key` and `/embeddings`, never on the public lists. The test embedding sends
  `provider: { data_collection: "deny", zdr: true }` (tested). A key with CR/LF cannot inject headers – `fetch` refuses
  it (reported as unreachable).
- **Authorization:** the page and both actions call `requireTechnician()`; the command's `allowedActors` is
  `["technician"]`; a helper's save and „Entfernen“ are refused in the integration test and the browser test (forged
  form with the helper's cookies).
- **CSRF:** both forms are Server Actions, POSTs to the page route; `src/proxy.ts` rejects a POST without the page's own
  origin on every non-`/api` path (matcher covers `/team/museum-settings`).

## Counts
blocker 0 · major 3 · minor 14 · follow-up 0 (no finding passes the follow-up hurdle: #1, #3, #13, #14 are carried by
ST-106/ST-107/ST-110/ST-112 as "revisit when …").

**Verdict: ready to merge** once the three majors are fixed (each well under an hour) – no blockers.
Most important finding: #10 – a rejection with the saved key (revoked or out of credits) is shown nowhere, the save just silently fails.

## Disposition (main session, 2026-11-01)

| # | Outcome |
|---|---|
| 10 | **fixed** – a rejection is said at its field only when the form shows that field, else under the form; integration test „says why a save is rejected also when the saved key causes it, whose field is not shown“ |
| 11 | **fixed** – `MODEL_ID` allows a leading `~` (alias IDs); adapter test |
| 12 | **fixed** – routers with price −1 are left out of the lists (their cost is not known beforehand); adapter test |
| 2 | fixed – a changed model without its fact throws |
| 4, 5, 6 | fixed – conventions reworded; `secret` is honoured by every runner step |
| 7 | fixed – the adapter drops the author from a model's name, so the form shows the story's wording |
| 15 | fixed – `authTagLength: 16`, a shortened tag is refused (test), AAD binds the ciphertext to its purpose |
| 16 | fixed – no redirect followed (test); `OPENROUTER_BASE_URL` ignored in production and documented as test-only |
| 17 | fixed – `autoComplete="new-password"` with the 1Password/LastPass opt-outs |
| 1 | skipped – revisit when ST-107/ST-112 add chat completions: ask OpenRouter before the command there |
| 3 | skipped – revisit in ST-106 (the policy reacting to "AI turned on") / ST-110 (the undecryptable key) |
| 8 | skipped – split the read model from the facts when ST-109/ST-110 touch the file |
| 9 | no action – false positives of the language check |
| 13 | skipped – revisit in ST-106/ST-107 with the domain's failure reasons |
| 14 | skipped – revisit in ST-110 (stream „KI“ behind `Suspense`; the long select on a phone) |

No finding passes the follow-up hurdle; no new story.
