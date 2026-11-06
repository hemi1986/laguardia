"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import type { FileCategory } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";
import type { ChangeFileDetailsData } from "./change-file-details-data";
import type { ChangeFileDetailsField, ChangeFileDetailsState } from "./change-file-details-form";

const { changeFileDetails: texts, fileCategories: categoryTexts } = teamMessages;

/** The field that caused a rejection – marked at the form (G8). */
const fieldOf: Partial<Record<NonNullable<ChangeFileDetailsState>["error"], ChangeFileDetailsField>> = {
  "title-required": "title",
  "file-category-required": "fileCategory",
};

/**
 * The form „Datei bearbeiten“ (CMD-ChangeFileDetails, ST-116, G20): the title and the file category filled in with the
 * current ones, posted with the version the page loaded. A rejection keeps what was typed and marks its field (G8), with
 * and without JavaScript. A removed file cannot be corrected: the form says that it is gone and has no submit (G7).
 */
export function ChangeFileDetailsForm({
  file,
  fileCategories,
  action,
}: {
  file: ChangeFileDetailsData;
  /** The file categories in the order the choice offers them – from the Collection module, via the page. */
  fileCategories: readonly FileCategory[];
  /** „Datei speichern“'s Server Action, the file and the origin already bound. */
  action: (previous: ChangeFileDetailsState, formData: FormData) => Promise<ChangeFileDetailsState>;
}) {
  const [state, run, pending] = useActionState(action, null);
  const rejectionId = useId();
  const kept = keptKey(state);
  const invalid = state ? fieldOf[state.error] : undefined;
  const marked = (field: ChangeFileDetailsField) => ({
    "aria-invalid": invalid === field || undefined,
    "aria-describedby": invalid === field ? rejectionId : undefined,
  });
  const category = state ? (state.values.fileCategory ?? "") : file.fileCategory;

  return (
    <form action={run} className="flex flex-col gap-5">
      <VersionField version={file.version} />
      {!file.removed && (
        <>
          <Field data-invalid={invalid === "title"}>
            <FieldLabel htmlFor="title">{texts.title}</FieldLabel>
            <Input
              id="title"
              name="title"
              key={`title-${kept}`}
              defaultValue={state ? state.values.title : file.title}
              {...marked("title")}
            />
          </Field>
          <Field data-invalid={invalid === "fileCategory"}>
            <FieldLabel htmlFor="fileCategory">{texts.fileCategory}</FieldLabel>
            <NativeSelect
              id="fileCategory"
              name="fileCategory"
              key={`fileCategory-${kept}`}
              defaultValue={category}
              {...marked("fileCategory")}
            >
              {category === "" && <option value="">{texts.choose}</option>}
              {fileCategories.map((value) => (
                <option key={value} value={value}>
                  {categoryTexts[value]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </>
      )}
      {(state || file.removed) && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state?.error ?? "file-removed")}</Rejection>
        </div>
      )}
      {!file.removed && (
        <Button type="submit" disabled={pending}>
          {texts.submit}
        </Button>
      )}
    </form>
  );
}
