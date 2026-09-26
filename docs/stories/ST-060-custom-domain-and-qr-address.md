---
id: ST-060
title: Custom domain and stable QR address scheme
type: tech-task
context: BC-Collection
priority: must
size: XS
risk: low
events: []
depends_on: [ST-001]
labels: [mvp, foundation]
status: ready
---

## Task
Before any QR sticker is printed (ST-011), La Guardia gets its own custom domain and a stable address scheme per machine, e.g. `/m/LG-042` (story review 2026-09-26, TT-C, decision D9). Printed stickers must never point to a provider's default address, which could change.

- The domain is registered by the museum and points to the production deployment (ST-001, ST-061).
- The QR address contains only the museum number; it opens the machine record for logged-in team members and the visitor machine page for everyone else (ST-011).
- The address scheme is fixed and documented; it never changes after the first sticker is printed.

## Acceptance Criteria
- [ ] The custom domain serves the production deployment over HTTPS.
- [ ] The address scheme (e.g. `/m/LG-042`) is documented in the repository.
- [ ] Opening the address of an existing museum number reaches the machine; an unknown museum number shows the "no such machine" page (ST-010).
- [ ] The provider's default address redirects to the custom domain or is not used in any link.

## Out of Scope
- Printing the stickers (ST-011)

## Open Questions
- none
