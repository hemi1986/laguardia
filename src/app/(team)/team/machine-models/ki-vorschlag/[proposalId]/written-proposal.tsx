import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Section } from "@/components/ui/section";
import type { AiModelProposalPage } from "@/modules/ai-assistance";
import { teamMessages } from "@/platform/messages";
import { machineModelChoices } from "../../choices";
import { MachineModelFields } from "../../machine-model-fields";
import { machineModelFields } from "../../machine-model-input";

const { aiModelProposals: texts } = teamMessages;

/**
 * A written AI model proposal (RM-AiModelProposal, ST-124; G2a's form logic, G3, G7): the machine model's fields already
 * filled in – a field the AI could not fill stays empty with „Nicht gefunden“ beside it –, the sources the fields rest
 * on and the documents found on the web, each ticked, with its title, file category and link. Nothing is loaded yet:
 * the links are only proposals (HS-40). „Speichern“ and „Verwerfen“ come with ST-127 and ST-128.
 */
export function WrittenAiModelProposal({ proposal }: { proposal: AiModelProposalPage }) {
  const fields = proposal.fields ?? {};
  const unfilled = machineModelFields.filter((field) => fields[field] === undefined);
  const documents = proposal.documents ?? [];
  const sources = proposal.sources ?? [];
  return (
    <>
      <div className="flex flex-col gap-5">
        <MachineModelFields
          {...machineModelChoices}
          given={{
            title: fields.title ?? "",
            manufacturer: fields.manufacturer ?? "",
            year: fields.year,
            // A field not filled stays empty – the select shows „Bitte wählen“.
            machineCategory: fields.machineCategory,
            technology: fields.technology,
          }}
          kept="proposal"
          rejectionId="proposal-rejection"
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
      <Section title={texts.loadFromTheWeb}>
        {documents.length === 0 ? (
          <p>{texts.noDocuments}</p>
        ) : (
          <ul className="flex flex-col gap-5">
            {documents.map((document, index) => (
              <li key={document.link} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    name="document"
                    value={index}
                    defaultChecked
                    aria-label={texts.documentTick(document.title)}
                  />
                  <Input
                    name={`documentTitle-${index}`}
                    defaultValue={document.title}
                    aria-label={texts.documentTitle}
                  />
                </div>
                <Field>
                  <FieldLabel htmlFor={`documentFileCategory-${index}`}>{texts.fileCategory}</FieldLabel>
                  <NativeSelect
                    id={`documentFileCategory-${index}`}
                    name={`documentFileCategory-${index}`}
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
