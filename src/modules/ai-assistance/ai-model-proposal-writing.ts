import { machineCategories, technologies } from "@/modules/collection";
import type { ChatAnswer, ChatFailure, ChatInput } from "./ai-seam";
import type { SessionStopped } from "./open-router-session";
import type { AiModelProposalAnswer } from "./ai-model-proposal";
import { proposedFileCategories } from "./ai-model-proposal";

/**
 * What an AI model proposal asks the chat model and what its answer comes to (ST-124, ADR 0020): one request with
 * OpenRouter's server tools for the web and a JSON object whose keys the prompt names. The answer is untrusted: it is
 * read here as plain values and bounded; what is valid is decided by CMD-WriteAiModelProposal.
 */

const systemPrompt = [
  "Du bist die KI-Unterstützung eines Flipper- und Arcade-Museums.",
  "Du bekommst die Beschreibung eines Geräts. Suche im Netz nach diesem Gerät und ergänze die Felder eines Gerätemodells.",
  `Gerätekategorie (machineCategory): ${machineCategories.join(", ")}.`,
  `Technik (technology): ${technologies.join(", ")} – pinball passt zu em, solid-state, dmd, lcd; arcade zu crt, lcd; bei other keine.`,
  "Nenne nur, was du gefunden hast; ein unbekanntes Feld lässt du leer (null). Rate nicht.",
  "Nenne außerdem Dokumente zum Gerät oder seiner Plattform, die du im Netz gefunden hast: ein offizielles Handbuch, Schaltpläne, Einträge des Pinball-Wikis und andere Textdokumente. Keine Bilder, keine Videos. Nur Adressen, die mit https beginnen und die du wirklich gesehen hast.",
  `Die Dateikategorie eines Dokuments ist eine von: ${proposedFileCategories.join(", ")}.`,
  "Nenne in sources die Adressen der Seiten, auf denen die Felder beruhen.",
  "Antworte nur mit einem JSON-Objekt in genau dieser Form:",
  '{"title": "…", "manufacturer": "…", "year": 1986, "machineCategory": "pinball", "technology": "solid-state", "sources": ["https://…"], "documents": [{"title": "…", "fileCategory": "manual", "link": "https://…"}]}',
  "Finde die Suche keine Dokumente, ist documents eine leere Liste.",
].join("\n");

/** The chat request for a description: the description as data, the web tools on. */
export function aiModelProposalChatRequest(description: string): ChatInput {
  return { system: systemPrompt, text: `Beschreibung des Geräts:\n${description}`, images: [], webTools: true };
}

/** The answer's bounds: an answer is untrusted and must not become an arbitrarily large stored row. */
const MAX_TEXT = 300;
const MAX_LINK = 2000;
const MAX_SOURCES = 20;
/** More than the 10 a proposal keeps, so duplicates and links that are not https do not take places from valid ones. */
const MAX_NAMED_DOCUMENTS = 40;

/**
 * What the chat model's request came to: the answer's plain values, or `"unusable"` – an answer that is not the agreed
 * form. A stopped session (AI turned off meanwhile) and OpenRouter's failures are told apart for the caller (ST-126).
 */
export function answerOfChat(
  answer: ChatAnswer | SessionStopped,
): AiModelProposalAnswer | "stopped" | "unusable" | { failure: ChatFailure } {
  if (answer === "stopped") return "stopped";
  if ("failure" in answer) return answer;
  return parseAiModelProposalAnswer(answer.content) ?? "unusable";
}

export function parseAiModelProposalAnswer(content: string): AiModelProposalAnswer | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const answer = parsed as Record<string, unknown>;
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_TEXT) : undefined;
  // A year named as a number is the same as one named as text.
  const year = typeof answer.year === "number" ? String(answer.year) : text(answer.year);
  return {
    ...(text(answer.title) && { title: text(answer.title) }),
    ...(text(answer.manufacturer) && { manufacturer: text(answer.manufacturer) }),
    ...(year && { year }),
    ...(text(answer.machineCategory) && { machineCategory: text(answer.machineCategory) }),
    ...(text(answer.technology) && { technology: text(answer.technology) }),
    sources: Array.isArray(answer.sources)
      ? answer.sources
          .flatMap((source) => (typeof source === "string" ? [source.slice(0, MAX_LINK)] : []))
          .slice(0, MAX_SOURCES)
      : [],
    documents: Array.isArray(answer.documents)
      ? answer.documents
          .flatMap((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
            const { title, fileCategory, link } = entry as Record<string, unknown>;
            if (typeof link !== "string" || typeof title !== "string") return [];
            return [
              {
                link: link.slice(0, MAX_LINK),
                title: title.slice(0, MAX_TEXT),
                fileCategory: String(fileCategory ?? ""),
              },
            ];
          })
          .slice(0, MAX_NAMED_DOCUMENTS)
      : [],
  };
}

/**
 * What the AI index is searched with once the fields are completed (ST-125): title, manufacturer, year and technology as
 * the answer named them – the text of one embedding request. Nothing named, nothing to search for, no request paid.
 */
export function existingFilesSearchText(answer: AiModelProposalAnswer): string | undefined {
  const text = [answer.title, answer.manufacturer, answer.year, answer.technology]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
  return text || undefined;
}
