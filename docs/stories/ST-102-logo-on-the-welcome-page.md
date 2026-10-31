---
id: ST-102
title: Replace or remove the museum's logo on the welcome page
type: story
context: BC-Collection
priority: should
size: L
risk: medium
events: [EVT-LogoReplaced, EVT-LogoRemoved]
depends_on: [ST-100]
labels: [ui, visitor, feature:museum-start-page]
status: done
---

## Story
As a technician, I want to upload, replace or remove the museum's logo in the museum settings, so that visitors recognise the museum at a glance on the welcome page.

## Context
Feature `museum-start-page` (user, `/feature` grilling and focused event storming 2026-10-31; `docs/domain/events.yaml`
**AGG-MuseumSettings**, **CMD-ReplaceLogo**, **CMD-RemoveLogo**, **EVT-LogoReplaced**, **EVT-LogoRemoved**,
**RM-WelcomePage**, **RM-MuseumSettings**; `docs/architecture/data-model.md`, section *Museum settings*, *Logo content*;
ADR 0009, ADR 0012; story review `docs/reviews/2026-10-31-museum-start-page-story-review.md`). Adds the section
**„Logo“** to the museum settings page that ST-100 owns (G18), after „Museum“ and before „Rechtstexte“. Adds the logo
to whichever welcome page exists – the minimal one of ST-078 or ST-101's; no dependency on ST-101.

**The form „Logo“** – technicians only (ACT-Technician; a helper never reaches the page, ST-100):
- Shows the current logo; without one it says so and offers only the upload (G7).
- **Upload** – the first logo is a replacement of none (`CMD-ReplaceLogo`). A PNG, JPEG or WebP image; the uploaded
  file is at most 2 MB. Anything else, SVG included, is rejected (invariant *at most one logo, a PNG, JPEG or WebP
  image without metadata*):
  - not such an image: „Bitte ein Bild als PNG, JPEG oder WebP wählen.“
  - an image with more pixels than a photo may have (the photo module's pixel limit, today 25 million pixels) – a
    small file can have huge dimensions – gets the same text: „Bitte ein Bild als PNG, JPEG oder WebP wählen.“
    (user, 2026-10-31)
  - the uploaded file larger than 2 MB: „Das Logo darf höchstens 2 MB groß sein.“
  - The server checks that the content really is such an image (not only its name).
  - **What is stored** (user, 2026-10-31): the image scaled down to at most 1000 px on its long edge (never enlarged –
    the welcome page shows it at most a third of the screen height); a JPEG's orientation applied, so a phone photo is
    upright; then every metadata dropped; an animated image becomes a still image of its first frame; transparency
    kept (a PNG or WebP stays a PNG or WebP with its transparency, a JPEG stays a JPEG).
  - The image goes through the server like a photo: stored, the command run with its reference, the content deleted if
    the command is rejected (ADR 0009) – a rejected upload leaves nothing behind.
  - These rejections are about the image itself, so no sentence about choosing it again is added (G8a, last
    paragraph); the chooser shows itself empty.
- **Remove** (`CMD-RemoveLogo`) – one tap, **no question page** (guideline G10c: content that can be uploaded again is
  removed in one step). Offered only while there is a logo (G11).
- **The previous logo's content is deleted** once a replacement or a removal is stored (deliberate removal, ADR 0009).
- **Version check of this part only:** if someone replaced or removed the logo meanwhile, uploading or removing is
  rejected with the usual „Jemand hat das inzwischen geändert. Bitte die Seite neu laden und noch einmal versuchen.“ and
  nothing changes. A save of the museum details or the legal texts in between never rejects it. The logo is kept as its
  own record with its own version, as ST-100 states for all three parts of the museum settings.

**The logo for visitors:** shown centred at the top of the welcome page, above the museum name, at most about a third
of the screen's height, so the name stays visible on a phone; without a logo the welcome page shows only the name. Only
the welcome page shows the logo. Visitors get it through the public address `/logo`: no login, it checks only whether
there is a logo and sends the browser on to a fresh view address valid for 5 minutes – as `/team/dateien/<id>` does for
team members. The browser may keep that redirect for 60 seconds (user, 2026-10-31), so the logo is not downloaded
again on every page view; behind it is still a freshly signed view address, and a replaced or removed logo shows for
at most a minute longer. Without a logo, `/logo` is not found. The welcome page itself only knows whether there is a
logo, never the logo's content reference. The store stays private and the content security policy unchanged.

**Definition of done** (not scenarios) – an amendment of the engineering conventions
(`.claude/skills/engineering-conventions/SKILL.md`) in this story, named in the pull request; the user approves it:
1. **Exception to „Only team pages issue view addresses“** (HS-1), with the sentence: "Exception: `/logo`, the
   museum's logo; the welcome page's data holds only whether a logo exists." That rule protects photos that may show
   people; the logo is public by nature.
2. **A logo acceptance of its own**, next to the photo acceptance: the photo module turns every image into a JPEG on a
   white background, which would destroy the logo's transparency. The logo's acceptance does what *What is stored*
   above says.
3. **A form step that skips the browser's photo preparation**, so the logo reaches the server as chosen (the browser
   preparation also turns every image into a JPEG).

**Interface:** usual page width (G16), dark design (G26), German team wording (G13), buttons that say what they do
(G14), confirmations after a change (G3). Decided (user, 2026-10-31): without a logo
„Noch kein Logo. Die Startseite zeigt nur den Namen.“; buttons „Logo hochladen“ (without a logo) / „Logo ersetzen“ and
„Logo entfernen“; confirmations „Logo gespeichert.“ and „Logo entfernt.“.

## Acceptance Criteria

Scenario: A technician uploads the first logo
  Given the museum has no logo
  When a technician uploads a PNG image of 300 KB as the logo
  Then the museum settings show the new logo with a confirmation
  And the welcome page shows the logo centred above the museum name
  And the change names the technician who made it

Scenario: Without a logo the welcome page shows only the museum name
  Given the museum has no logo
  When a technician opens the museum settings
  Then the form „Logo“ says that there is no logo yet and offers only the upload
  And the welcome page shows only the museum name above everything else

Scenario: A technician replaces the logo
  Given the museum has a logo
  When a technician uploads a WebP image as the new logo
  Then the welcome page shows the new logo
  And the previous logo's content is deleted

Scenario: A technician removes the logo without being asked
  Given the museum has a logo
  When a technician removes the logo
  Then the logo is removed at once, without a question first
  And the welcome page shows only the museum name
  And the removed logo's content is deleted
  And the technician can upload a logo again

Scenario: The stored logo is scaled down, carries no metadata and keeps its transparency
  Given a PNG image of 2400 × 1200 pixels with a transparent background and a camera's EXIF data including a location
  When a technician uploads it as the logo
  Then the stored logo is 1000 × 500 pixels
  And it contains no EXIF or other metadata
  And its background is still transparent

Scenario: Anything but a PNG, JPEG or WebP image within the pixel limit is rejected
  Given the museum has a logo
  When a technician uploads an SVG image, a PDF document named "logo.png", or a PNG image of 20 000 × 20 000 pixels smaller than 2 MB as the logo
  Then the upload is rejected with „Bitte ein Bild als PNG, JPEG oder WebP wählen.“
  And the logo is unchanged and nothing of the rejected file is kept

Scenario: A logo larger than 2 MB is rejected
  When a technician uploads a JPEG image of 3 MB as the logo
  Then the upload is rejected with „Das Logo darf höchstens 2 MB groß sein.“
  And the logo is unchanged

Scenario: A logo changed by someone else meanwhile is not overwritten
  Given a technician opened the museum settings while the museum had a logo
  And another technician then removed the logo
  When the first technician uploads a new logo, or removes the logo
  Then it is rejected with „Jemand hat das inzwischen geändert. Bitte die Seite neu laden und noch einmal versuchen.“
  And the museum still has no logo and nothing of the uploaded image is kept

Scenario: Visitors get the logo without logging in
  Given the museum has a logo
  When someone who is not logged in opens the address "/logo"
  Then they are sent on to an address showing the logo
  And that address no longer shows it after 5 minutes
  And the browser may reuse the sending-on for at most 60 seconds
  But without a logo the address "/logo" is not found

Scenario: Helpers cannot replace or remove the logo
  Given the museum has a logo
  When a helper sends an upload or a removal of the logo
  Then it is rejected and the logo is unchanged

## Out of Scope
- The logo anywhere but the welcome page (team pages, visitor machine page, QR sticker sheet, browser tab icon)
- Cropping or editing the image in La Guardia (beyond the scaling down on upload)
- SVG logos, animated logos
- Several logos, or a logo per language

## Open Questions
None – the wording was decided by the user on 2026-10-31 (see Context). Removing the logo without a question page is
guideline G10c (2026-10-31). Scaling to 1000 px, the pixel limit's text, the 60-second redirect and the priority
`should` were decided by the user after the story review (2026-10-31).
