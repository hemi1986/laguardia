"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import type { AttachTarget, FileCategory } from "@/modules/collection";
import { keptKey } from "@/app/_actions/form-parts";
import { ChosenFile, rejectionWithChosenFile } from "@/app/(team)/team/chosen-file";
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

/** The rejections of the form's own fields – asked before a file is handed over, so they never touch it. */
const formOwn: readonly ErrorCode[] = ["title-required", "file-category-required", "attach-to-required"];

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
    <form action={action} className="flex flex-col gap-5" data-machine-id={machineId}>
      <ChosenFile
        key={`content-${kept}`}
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

/** The rejection, and what happened to the chosen file (G8a) – with this form's own rejections, which never touch it. */
export function rejectionWithFile(state: NonNullable<AttachFileState>, texts: Texts): string {
  return rejectionWithChosenFile(state, texts, formOwn);
}
