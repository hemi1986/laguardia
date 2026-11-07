import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Section } from "@/components/ui/section";
import type { AiModelProposalPage } from "@/modules/ai-assistance";
import { teamMessages } from "@/platform/messages";
import { machineModelFields } from "../../machine-model-field-names";
import { MachineModelFields, type Choices } from "../../machine-model-fields";
import { DOCUMENT_FIELD, documentFileCategoryField, documentTitleField } from "./document-fields";

const { aiModelProposals: texts } = teamMessages;

/** What a rejected „Speichern“ keeps (the runner's state): the typed fields and the ticks, as they were. */
export type KeptProposalForm = {
  error: string;
  values: Partial<Record<(typeof machineModelFields)[number], string>>;
  chosen: readonly string[];
};

/**
 * The fields, sources and documents of a written AI model proposal (RM-AiModelProposal, ST-124, ST-128; G2a's form logic,
 * G3, G7): the machine model's fields already filled in – a field the AI could not fill stays empty with „Nicht gefunden“
 * beside it –, the hint when a machine model with this title and manufacturer exists (HS-39), the sources the fields rest
 * on, and the documents: the files the museum has and the links from the web, each ticked, a link with its title and file
 * category to change. Nothing is loaded here: the links are only proposals (HS-40). Free of server code, so the form that
 * saves it (a client component) can render it; the choices of the selects come from the server.
 */
export function WrittenProposalFields({
  proposal,
  choices,
  fileAddresses,
  kept,
  keptKey,
  rejectionId,
}: {
  proposal: AiModelProposalPage;
  choices: Choices;
  /** Where each existing file's details are, by file ID – built on the server: the address module imports server code. */
  fileAddresses: Readonly<Record<string, string>>;
  /** After a rejection: what was typed and ticked, which the form shows instead of the proposal's. */
  kept?: KeptProposalForm;
  /** `keptKey(state)` – the fields keyed on it keep the typed value through React's form reset. */
  keptKey: string;
  rejectionId: string;
}) {
  const fields = proposal.fields ?? {};
  const unfilled = machineModelFields.filter((field) => fields[field] === undefined);
  const documents = proposal.documents ?? [];
  // The tick of a document: all ticked at first, afterwards as they were ticked. The place of a document is its tick's value.
  const ticked = (index: number) => (kept ? kept.chosen.includes(String(index)) : true);
  const places = documents.map((document, index) => ({ document, index }));
  const existingFiles = places.flatMap(({ document, index }) =>
    document.kind === "file" ? [{ document, index }] : [],
  );
  const links = places.flatMap(({ document, index }) => (document.kind === "link" ? [{ document, index }] : []));
  const sources = proposal.sources ?? [];
  return (
    <>
      {proposal.sameModel && (
        <p className="text-sm">
          {texts.sameModel}{" "}
          <Link href={`/team/machine-models/${proposal.sameModel.id}`} className="underline underline-offset-4">
            {texts.toTheModel}
          </Link>
        </p>
      )}
      <div className="flex flex-col gap-5">
        <MachineModelFields
          {...choices}
          given={{
            title: fields.title ?? "",
            manufacturer: fields.manufacturer ?? "",
            year: fields.year,
            // A field not filled stays empty – the select shows „Bitte wählen“.
            machineCategory: fields.machineCategory,
            technology: fields.technology,
          }}
          rejection={kept}
          kept={keptKey}
          rejectionId={rejectionId}
          notFound={{ fields: unfilled, text: texts.notFound }}
        />
      </div>
      <Section title={texts.sources}>
        {sources.length === 0 ? (
          <p className="text-muted-foreground text-sm">{texts.noSources}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {sources.map((source) => (
              <li key={source}>
                <a href={source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  {source}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {existingFiles.length > 0 && (
        <Section title={texts.alreadyInTheMuseum}>
          <ul className="flex flex-col gap-3">
            {existingFiles.map(({ document, index }) => (
              <li key={document.fileId} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {/* A file removed meanwhile can no longer be attached: it is shown as removed and not ticked (HS-38). */}
                  {!document.removed && (
                    <Checkbox
                      key={`${DOCUMENT_FIELD}-${index}-${keptKey}`}
                      name={DOCUMENT_FIELD}
                      value={index}
                      defaultChecked={ticked(index)}
                      aria-label={texts.attachTick(document.title)}
                    />
                  )}
                  <span>{document.title}</span>
                </div>
                {document.removed ? (
                  <p className="text-muted-foreground text-sm">{texts.removedFile}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {texts.fileCategory}: {texts.fileCategories[document.fileCategory]} ·{" "}
                    <a
                      href={fileAddresses[document.fileId]}
                      className="underline underline-offset-4"
                      aria-label={texts.fileDetails(document.title)}
                    >
                      {texts.details}
                    </a>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={texts.loadFromTheWeb}>
        {links.length === 0 ? (
          <p>{texts.noDocuments}</p>
        ) : (
          <ul className="flex flex-col gap-5">
            {links.map(({ document, index }) => (
              <li key={document.link} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    key={`${DOCUMENT_FIELD}-${index}-${keptKey}`}
                    name={DOCUMENT_FIELD}
                    value={index}
                    defaultChecked={ticked(index)}
                    aria-label={texts.documentTick(document.title)}
                  />
                  <Input
                    key={`title-${index}-${keptKey}`}
                    name={documentTitleField(index)}
                    defaultValue={document.title}
                    aria-label={texts.documentTitle}
                  />
                </div>
                <Field>
                  <FieldLabel htmlFor={documentFileCategoryField(index)}>{texts.fileCategory}</FieldLabel>
                  <NativeSelect
                    key={`category-${index}-${keptKey}`}
                    id={documentFileCategoryField(index)}
                    name={documentFileCategoryField(index)}
                    defaultValue={document.fileCategory}
                    aria-label={texts.documentFileCategory(document.title)}
                  >
                    {(["manual", "schematic", "other"] as const).map((category) => (
                      <option key={category} value={category}>
                        {texts.fileCategories[category]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <p className="text-muted-foreground text-sm [overflow-wrap:anywhere]">
                  {texts.documentLink}:{" "}
                  <a
                    href={document.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    {document.link}
                  </a>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
