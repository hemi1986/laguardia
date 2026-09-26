---
status: accepted
date: 2026-09-26
---

# 0004 – Team authentication: own accounts managed by technicians, no e-mail; visitors anonymous

Team members have personal accounts that technicians manage, visitors report without an account, and La Guardia sends no e-mail or push (`docs/product/vision.md`: Scope Notes, Non-Goals; operating effort minimal). We propose: **team members log in with a username and password stored in La Guardia's own database; technicians create accounts, set the role (helper / technician), reset passwords and deactivate accounts – no e-mail address is required and no e-mail is ever sent.** Sessions are long-lived on personal phones and stored server-side, so deactivating an account ends its sessions. An established authentication library is used (no hand-written password handling), and all role checks (e.g. "Helpers can only set Out of order", "Helpers can only claim defects suitable for helpers") happen in the server-side command layer. Visitor pages and *Report problem* are public, addressed by museum number from the QR code.

## Considered Options
- **Login via Google or another external identity provider**: rejected – not every volunteer has or wants such an account, and it adds a third-party dependency.
- **Magic links / password reset by e-mail**: rejected – requires e-mail addresses and a mail-sending service, against minimal operations and the "no e-mail" stance; technicians are on site and can reset passwords.
- **Passkeys**: a possible later addition; recovery still needs a technician, so it does not replace this setup.

## Consequences
- The first technician account is created at setup (e.g. a one-off setup step).
- Long-lived sessions mean "last login" rarely changes – the dashboards' "new since last login" likely needs "last seen" instead (HS-21 in `docs/domain/events.yaml`).
- Assumption to confirm: resetting passwords only via a technician (no self-service) is acceptable.
