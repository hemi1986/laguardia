"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import type { AttachTarget, FileCategory } from "@/modules/collection";
import { rejectionText } from "@/app/_actions/rejection-text";
import { keptKey } from "@/app/_actions/form-parts";
import { uploadFile } from "@/upload/browser";
import type { AttachFileState } from "./actions";
import type { AttachFileField } from "./attach-file-form";

type Texts = {
  file: string;
  fileHint: string;
  uploading: string;
  uploaded: string;
  title: string;
  fileCategory: string;
  choose: string;
  fileCategories: Record<FileCategory, string>;
  attachTo: string;
  onlyMachine: string;
  allMachinesOfModel: string;
  submit: string;
  stillAttached: string;
  chooseAgain: string;
  tooLarge: string;
  notUploaded: string;
};

type ErrorCode = NonNullable<AttachFileState>["error"];

/** The field that caused a rejection – marked at the form (G8). */
const fieldOf: Partial<Record<ErrorCode, AttachFileField>> = {
  "title-required": "title",
  "file-category-required": "fileCategory",
  "attach-to-required": "attachTo",
  "file-required": "content",
  "content-gone": "content",
  "too-large": "content",
};

/** The chosen file: uploading, uploaded (its content's name to send), or refused before it was attached. */
type Chosen =
  | { state: "uploading"; percent: number }
  | { state: "uploaded"; content: string; fileName: string }
  | { state: "failed"; text: string };

/**
 * The form that attaches a file (ST-037). The chosen file is uploaded at once, straight to the private store, while
 * the team member fills in the rest (ST-085); the form sends only its name. After a rejection of the form's own fields
 * the chosen file is still attached and the form says so; after any other rejection it must be chosen again (G8a,
 * user 2026-10-18). Choices are not preselected (G20).
 */
export function AttachFileForm({
  action: bound,
  machineId,
  museumNumber,
  machineModel,
  fileCategories,
  attachTargets,
  texts,
}: {
  /** The file categories and targets in the order the choices offer them – from the Collection module, via the page. */
  fileCategories: readonly FileCategory[];
  attachTargets: readonly AttachTarget[];
  action: (previous: AttachFileState, formData: FormData) => Promise<AttachFileState>;
  machineId: string;
  museumNumber: string;
  machineModel: string;
  texts: Texts;
}) {
  const [state, action, pending] = useActionState(bound, null);
  const [uploading, setUploading] = useState(false);
  const rejectionId = useId();
  const kept = keptKey(state);
  const invalid = state ? fieldOf[state.error] : undefined;
  const marked = (field: AttachFileField, hint?: string) => {
    const describedBy = [hint, invalid === field ? rejectionId : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": invalid === field || undefined, "aria-describedby": describedBy || undefined };
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="machineId" value={machineId} />
      <ChosenFile
        key={`content-${kept}`}
        machineId={machineId}
        keptContent={state?.values.content}
        keptFileName={state?.values.fileName}
        texts={texts}
        fieldProps={marked("content", "file-hint")}
        invalid={invalid === "content"}
        onUploading={setUploading}
      />
      <Field data-invalid={invalid === "title"}>
        <FieldLabel htmlFor="title">{texts.title}</FieldLabel>
        <Input id="title" name="title" defaultValue={state?.values.title} key={`title-${kept}`} {...marked("title")} />
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
      <Field data-invalid={invalid === "attachTo"}>
        <FieldLabel htmlFor="attachTo">{texts.attachTo}</FieldLabel>
        <NativeSelect
          id="attachTo"
          name="attachTo"
          key={`attachTo-${kept}`}
          defaultValue={state?.values.attachTo ?? ""}
          {...marked("attachTo")}
        >
          <option value="">{texts.choose}</option>
          {attachTargets.map((target) => (
            <option key={target} value={target}>
              {target === "machine"
                ? texts.onlyMachine.replace("{museumNumber}", museumNumber)
                : texts.allMachinesOfModel.replace("{machineModel}", machineModel)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionWithFile(state, texts)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending || uploading}>
        {texts.submit}
      </Button>
    </form>
  );
}

/**
 * The rejection, and what happened to the chosen file (G8a): still attached after a rejection of the form's own
 * fields, gone otherwise – except where the text itself says what to do (no file, too large).
 */
export function rejectionWithFile(state: NonNullable<AttachFileState>, texts: Texts): string {
  const reason = rejectionText(state.error, { "too-large": texts.tooLarge });
  if (state.error === "file-required" || state.error === "too-large") return reason;
  if (state.values.content) return `${reason} ${texts.stillAttached.replace("{fileName}", state.values.fileName)}`;
  return `${reason} ${texts.chooseAgain}`;
}

function ChosenFile({
  machineId,
  keptContent,
  keptFileName,
  texts,
  fieldProps,
  invalid,
  onUploading,
}: {
  onUploading: (uploading: boolean) => void;
  machineId: string;
  keptContent: string | undefined;
  keptFileName: string | undefined;
  texts: Texts;
  fieldProps: { "aria-invalid"?: boolean; "aria-describedby"?: string };
  invalid: boolean;
}) {
  const [chosen, setChosen] = useState<Chosen | undefined>(
    keptContent ? { state: "uploaded", content: keptContent, fileName: keptFileName ?? "" } : undefined,
  );

  async function choose(file: File | undefined) {
    if (!file) return setChosen(undefined);
    setChosen({ state: "uploading", percent: 0 });
    onUploading(true);
    const uploaded = await uploadFile(file, {
      owner: { machineId },
      onProgress: (percent) => setChosen({ state: "uploading", percent }),
    });
    onUploading(false);
    setChosen(
      uploaded.ok
        ? { state: "uploaded", content: uploaded.name, fileName: file.name }
        : { state: "failed", text: uploaded.error === "too-large" ? texts.tooLarge : texts.notUploaded },
    );
  }

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor="file">{texts.file}</FieldLabel>
      <Input id="file" type="file" onChange={(event) => void choose(event.target.files?.[0])} {...fieldProps} />
      <FieldDescription id="file-hint">{texts.fileHint}</FieldDescription>
      {chosen?.state === "uploading" && (
        <p role="status" className="text-sm">
          {texts.uploading.replace("{percent}", String(chosen.percent))}
        </p>
      )}
      {chosen?.state === "uploaded" && (
        <p role="status" className="text-sm break-all">
          {texts.uploaded.replace("{fileName}", chosen.fileName)}
        </p>
      )}
      {chosen?.state === "failed" && <Rejection>{chosen.text}</Rejection>}
      <input type="hidden" name="content" value={chosen?.state === "uploaded" ? chosen.content : ""} />
      <input type="hidden" name="fileName" value={chosen?.state === "uploaded" ? chosen.fileName : ""} />
    </Field>
  );
}
