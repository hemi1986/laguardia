import { createHash, randomUUID } from "node:crypto";
import { executeCommand } from "@/platform/command";
import type { WebFetcher } from "@/platform/web-fetch";
import { FILE_SIZE_LIMIT } from "@/upload";
import type { DocumentFailureReason, ProposedLink } from "./ai-model-proposal";
import { acceptedProposalsWithWaitingLinks } from "./ai-model-proposals";
import type { AiWorkContext, AiWorkKind } from "./ai-work";
import { loadProposedDocumentCommand } from "./load-proposed-document-command";
import type { LoadProposedDocumentInput } from "./load-proposed-document";
import { documentContent } from "./proposed-document-content";

/**
 * Loading the chosen links of an accepted AI model proposal as a kind of the background work (ST-129, ADR 0019,
 * POL-AcceptedProposalDocumentsAreLoaded, ADR 0015): one piece per link. A run holds the link, fetches it through the
 * web-fetch seam and stores the content outside any transaction, and only the recording – CMD-LoadProposedDocument, which
 * adds the file – is one short transaction that ends the hold. A link that fails records its reason and fails alone: the
 * machine model and the other links stay. It needs no AI; the file is indexed afterwards by the kind that indexes files.
 */
const PROPOSED_DOCUMENT_KIND = "proposed-document";

/**
 * The ID of a link's piece in the holds: the same link always has the same one, so a hold keeps two runs from loading it
 * together. A link has no ID of its own – its place in the proposal's documents never changes once written.
 */
export function proposedDocumentPieceId(aiModelProposalId: string, index: number): string {
  const hex = createHash("sha256").update(`${aiModelProposalId}:${index}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

type WaitingLink = { aiModelProposalId: string; index: number; link: ProposedLink };

/** Every chosen link still waiting, the oldest proposal first – a link of the proposal that was saved first is loaded first. */
async function waitingLinks(db: AiWorkContext["db"]): Promise<(WaitingLink & { pieceId: string })[]> {
  return (await acceptedProposalsWithWaitingLinks(db)).flatMap((proposal) =>
    (proposal.documents ?? []).flatMap((document, index) =>
      document.kind === "link" && document.chosen && document.loading === "waiting"
        ? [{ aiModelProposalId: proposal.id, index, link: document, pieceId: proposedDocumentPieceId(proposal.id, index) }]
        : [],
    ),
  );
}

const inputOf = (piece: WaitingLink, outcome: LoadProposedDocumentInput["outcome"]): LoadProposedDocumentInput => ({
  aiModelProposalId: piece.aiModelProposalId,
  index: piece.index,
  outcome,
});

/** The last part of the address as the file's original name – none for an address that ends in a directory. */
function originalFileNameOf(address: string): string | undefined {
  try {
    const last = new URL(address).pathname.split("/").filter(Boolean).pop();
    const name = last && decodeURIComponent(last);
    return name && name.includes(".") ? name : undefined;
  } catch {
    return undefined;
  }
}

export function proposedDocumentWork(web: WebFetcher): AiWorkKind {
  return {
    kind: PROPOSED_DOCUMENT_KIND,

    async waiting(db) {
      return (await waitingLinks(db)).map(({ pieceId }) => pieceId);
    },

    async isWaiting(tx, id) {
      return (await waitingLinks(tx)).some(({ pieceId }) => pieceId === id);
    },

    async work(id, piece, context) {
      const waiting = (await waitingLinks(context.db)).find(({ pieceId }) => pieceId === id);
      if (!waiting) return piece.giveUp();
      const fetched = await web.fetch(waiting.link.link, { maxBytes: FILE_SIZE_LIMIT });
      let outcome: LoadProposedDocumentInput["outcome"];
      let contentName: string | undefined;
      if (!fetched.ok) {
        outcome = { kind: "failed", reason: fetched.reason };
      } else {
        const content = documentContent(fetched.contentType, fetched.bytes);
        if (content === "not-pdf-or-text") {
          outcome = { kind: "failed", reason: "not-pdf-or-text" };
        } else if (content.bytes.length > FILE_SIZE_LIMIT) {
          // A web page's text is never larger than the page, but the limit is the file's, whatever it came from.
          outcome = { kind: "failed", reason: "too-large" };
        } else {
          contentName = `files/${randomUUID()}`;
          await context.storage.write(contentName, content.bytes, content.contentType);
          const originalFileName = originalFileNameOf(waiting.link.link);
          outcome = {
            kind: "loaded",
            content: { name: contentName, size: content.bytes.length, contentType: content.contentType },
            ...(originalFileName && { originalFileName }),
          };
        }
      }
      let recorded = false;
      try {
        const stored = await piece.storeResult(async (tx) => {
          const result = await executeCommand(loadProposedDocumentCommand, inputOf(waiting, outcome), {
            actor: { kind: "system" },
            db: tx,
            clock: context.clock,
          });
          recorded = result.ok;
        });
        recorded &&= stored === "stored";
      } finally {
        // The content belongs to a file only when the file was recorded: a late result or a rejection leaves none behind.
        if (contentName && !recorded) await deleteQuietly(context, contentName);
      }
    },

    /** POL-UnfinishedAiWorkFails: a link whose hold ran out is failed as *broken off*; nothing is fetched or stored. */
    async recordBrokenOff(tx, id, context) {
      const waiting = (await waitingLinks(tx)).find(({ pieceId }) => pieceId === id);
      if (!waiting) return;
      const reason: DocumentFailureReason = "broken-off";
      await executeCommand(loadProposedDocumentCommand, inputOf(waiting, { kind: "failed", reason }), {
        actor: { kind: "system" },
        db: tx,
        clock: context.clock,
      });
    },
  };
}

async function deleteQuietly(context: AiWorkContext, name: string): Promise<void> {
  try {
    await context.storage.delete(name);
  } catch {
    // unreferenced and unreachable without a signed address – accepted (ADR 0009)
  }
}
