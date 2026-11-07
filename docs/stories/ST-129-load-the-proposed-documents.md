---
id: ST-129
title: The chosen links of a saved proposal are loaded as files
type: domain
context: BC-AiAssistance
aggregate: AGG-AiModelProposal
command: CMD-LoadProposedDocument
ui: true
priority: must
size: L
risk: high
events: [EVT-ProposedDocumentLoaded, EVT-ProposedDocumentFailed]
depends_on: [ST-128]
labels: [feature:ai-model-proposal]
status: ready
---

## Story
As a technician who saved an AI model proposal, I want the ticked links loaded as files of the new machine model, so that the manual is on the machine model without my downloading and uploading it.

## Context
Feature `ai-model-proposal` (user, 2026-11-07, grilling Q5 and Q10 (b); `docs/domain/events.yaml`
**CMD-LoadProposedDocument**, **EVT-ProposedDocumentLoaded**, **EVT-ProposedDocumentFailed**, **CMD-AddFile**,
**POL-AcceptedProposalDocumentsAreLoaded**, **POL-AddedFileIsIndexedForAi**, resolved **HS-40**; ADR 0019; ADR 0018;
ADR 0012; ADR 0009). In the background after ST-128's response, once per link, each in its own transaction.

**What happens:** the link is fetched, its content stored and added with `CMD-AddFile` as a file with the title and
file category the technician saw, attached to the new machine model. A web page is stored as the text of the page
(Markdown/text, file category as chosen, normally Sonstiges). The file is then indexed for AI like any added file (ADR 0017,
no new rule); while AI is off only the indexing waits.

**Limits (rules):** only `https`; not the museum's own address or any private network, also not after a redirect; a
PDF or text/Markdown content; at most 100 MB; nothing from the content is executed. A link that does not meet them
fails **alone** with its reason – „nicht erreichbar“, „zu groß“, „kein PDF oder Text“, „Adresse nicht erlaubt“,
„abgebrochen“ – and the machine model and the other documents stay. The proposal page shows per link „wird geladen …“,
„geladen“ with a link to the file, or the reason with „Nochmal versuchen“ (ST-130). A link broken off by a crash or the
time limit is failed as „abgebrochen“ by the next run (POL-UnfinishedAiWorkFails); a late result records nothing.

## Acceptance Criteria

Scenario: A link becomes a file of the machine model
  Given a saved AI model proposal with the ticked link "https://example.org/high-speed-manual.pdf" titled "High Speed Manual" with the file category Handbuch
  When the link is loaded and it is a PDF of 3 MB
  Then the file "High Speed Manual" with the file category Handbuch exists, attached to the machine model "High Speed"
  And the proposal page shows the link as loaded

Scenario: A link that cannot be reached fails alone
  Given a saved AI model proposal with two ticked links, one of which does not answer
  When both links are loaded
  Then the link that did not answer is failed with the reason „nicht erreichbar“
  And the other one became a file and the machine model stays

Scenario: An address that is not allowed
  Given a saved AI model proposal with the ticked link "http://192.168.0.5/manual.pdf"
  When the link is loaded
  Then it is failed with the reason „Adresse nicht erlaubt“ and nothing was fetched

Scenario: Content that is too large or not a PDF or text
  Given a saved AI model proposal with a ticked link to a 150 MB PDF and one to a ZIP archive
  When both links are loaded
  Then the first is failed with the reason „zu groß“ and the second with „kein PDF oder Text“

## Out of Scope
- Retrying a failed link (ST-130)
- Indexing the file for AI (existing policy)

## Open Questions
- none
