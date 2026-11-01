# Repository map

> Generated from the repository's manifests by `repo-map.ts` – **do not edit manually**. Refresh with
> `node .claude/skills/adopt/scripts/repo-map.ts`.

- **Tooling:** none (single package)
- **Workspaces:** –
- **Packages:** 1 (1 app/service, 0 libraries)
- **Adopted:** 1 of 1
- **Tool graph:** manifests only

## Packages

| Package | Path | Kind | Language | Depends on | Used by | Adopted |
|---|---|---|---|---|---|---|
| laguardia | `.` | app | TypeScript | – | – | yes |

## Commands

| Scope | Command |
|---|---|
| Install | `npm install` |

## Adoption ranking

| # | Package | Score | Why |
|---|---|---|---|
| 1 | `.` (laguardia) | 0.70 | 2839 changed files in recent history; app |

## Suggested first slice

- **Domain:** root package (laguardia)

Adopt one domain and at most one shared library per session. Then mark the slice adopted:

```bash
node .claude/skills/adopt/scripts/repo-map.ts --adopt .
```
