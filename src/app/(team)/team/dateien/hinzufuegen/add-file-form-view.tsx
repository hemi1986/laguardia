"use client";

import { useActionState, useId, useRef, useState } from "react";
import { keptKey } from "@/app/_actions/form-parts";
import { ChosenFile, rejectionWithChosenFile, type ChosenFileTexts } from "@/app/(team)/team/chosen-file";
import { TeamGroupedChoice } from "@/app/(team)/team/team-grouped-choice";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import type { FileCategory } from "@/modules/collection";
import type { AddFileState } from "./actions";
import type { AddFileField } from "./add-file-form";
import { ADD_FILE_TARGETS } from "./add-file-targets";
import { titleFromFileName } from "./title-from-file-name";

type Texts = ChosenFileTexts & {
  title: string;
  fileCategory: string;
  choose: string;
  attachTo: string;
  attachToHint: string;
  machines: string;
  machineModels: string;
  submit: string;
  fileCategories: Record<FileCategory, string>;
};

type ErrorCode = NonNullable<AddFileState>["error"];

/** The field that caused a rejection – marked at the form (G8). */
const fieldOf: Partial<Record<ErrorCode, AddFileField>> = {
  "title-required": "title",
  "file-category-required": "fileCategory",
  "file-required": "content",
  "content-gone": "content",
  "too-large": "content",
};

/** The rejections of the form's own fields – asked before a file is handed over, so they never touch it. */
export const addFileOwnRejections: readonly ErrorCode[] = ["title-required", "file-category-required"];

/** The rejection and what happened to the chosen file (G8a) – the one wording the form and its tests share. */
export function addFileRejection(state: NonNullable<AddFileState>, texts: ChosenFileTexts): string {
  return rejectionWithChosenFile(state, texts, addFileOwnRejections);
}

/**
 * The form „Datei hinzufügen“ in the file overview (ST-119, G2a): the file – uploaded at once, straight to the private
 * store (ST-085) –, „Titel“, „Dateikategorie“ and, optionally, what the file is attached to (G27). With JavaScript
 * choosing the file fills „Titel“ with its name without the last ending, never over what the person typed; without it
 * „Titel“ stays empty. After a rejection of the form's own fields the chosen file is still attached and the form says
 * so, after any other rejection it must be chosen again (G8a). Nothing is preselected (G20).
 */
export function AddFileFormView({
  action: bound,
  fileCategories,
  machineGroups,
  machineModelGroups,
  texts,
}: {
  action: (previous: AddFileState, formData: FormData) => Promise<AddFileState>;
  /** The file categories in the order the choice offers them – from the Collection module, via the page. */
  fileCategories: readonly FileCategory[];
  machineGroups: ChoiceGroup[];
  machineModelGroups: ChoiceGroup[];
  texts: Texts;
}) {
  const [state, action, pending] = useActionState(bound, null);
  const [uploading, setUploading] = useState(false);
  const rejectionId = useId();
  const kept = keptKey(state);
  const invalid = state ? fieldOf[state.error] : undefined;
  const marked = (field: AddFileField, hint?: string) => {
    const describedBy = [hint, invalid === field ? rejectionId : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": invalid === field || undefined, "aria-describedby": describedBy || undefined };
  };

  // „Titel“ holds what the person typed, or – until they type – the name of the chosen file (never over their own).
  const title = useRef<HTMLInputElement>(null);
  const prefilled = useRef<string | undefined>(undefined);
  function fillTitleFrom(fileName: string) {
    const input = title.current;
    if (!input || (input.value !== "" && input.value !== prefilled.current)) return;
    prefilled.current = titleFromFileName(fileName);
    input.value = prefilled.current;
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <ChosenFile
        key={`content-${kept}`}
        keptContent={state?.values.content}
        keptFileName={state?.values.fileName}
        texts={texts}
        fieldProps={marked("content", "file-hint")}
        invalid={invalid === "content"}
        onUploading={setUploading}
        onChosen={fillTitleFrom}
      />
      <Field data-invalid={invalid === "title"}>
        <FieldLabel htmlFor="title">{texts.title}</FieldLabel>
        <Input
          id="title"
          name="title"
          ref={title}
          defaultValue={state?.values.title}
          key={`title-${kept}`}
          {...marked("title")}
        />
      </Field>
      <Field data-invalid={invalid === "fileCategory"}>
        <FieldLabel htmlFor="fileCategory">{texts.fileCategory}</FieldLabel>
        <NativeSelect
          id="fileCategory"
          name="fileCategory"
          key={`fileCategory-${kept}`}
          defaultValue={state?.values.fileCategory ?? ""}
          {...marked("fileCategory")}
        >
          <option value="">{texts.choose}</option>
          {fileCategories.map((category) => (
            <option key={category} value={category}>
              {texts.fileCategories[category]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{texts.attachTo}</h2>
        <p className="text-muted-foreground text-sm" id="attach-to-hint">
          {texts.attachToHint}
        </p>
        {machineGroups.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{texts.machines}</h3>
            <TeamGroupedChoice
              key={`machines-${kept}`}
              name={ADD_FILE_TARGETS}
              groups={machineGroups}
              chosen={state?.chosen ?? []}
            />
          </section>
        )}
        {machineModelGroups.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{texts.machineModels}</h3>
            <TeamGroupedChoice
              key={`models-${kept}`}
              name={ADD_FILE_TARGETS}
              groups={machineModelGroups}
              chosen={state?.chosen ?? []}
            />
          </section>
        )}
      </section>
      {state && (
        <div id={rejectionId}>
          <Rejection>{addFileRejection(state, texts)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending || uploading}>
        {texts.submit}
      </Button>
    </form>
  );
}
