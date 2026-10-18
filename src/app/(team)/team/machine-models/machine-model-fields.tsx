import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { CorrectMachineModelError, MachineCategory, MachineModel, Technology } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";
import type { MachineModelField } from "./create-machine-model-input";

const { machineModels: texts, terms } = teamMessages;

/**
 * What the two selects offer. The page builds them – a client component must not import the Collection module
 * itself, or the module's server code (and with it `pg`) would end up in the browser bundle; only the types are
 * imported, and those are erased.
 */
export type Choices = {
  categories: { value: MachineCategory; label: string }[];
  /** Every technology once, its label naming the machine categories it fits. */
  technologies: { value: Technology; label: string }[];
};

/** The field that caused a rejection – marked at the form (G8). The others have no field of their own. */
const fieldOf: Partial<Record<CorrectMachineModelError, MachineModelField>> = {
  "title-required": "title",
  "manufacturer-required": "manufacturer",
  "year-must-be-four-digits": "year",
  "machine-category-required": "machineCategory",
  "technology-does-not-fit-machine-category": "technology",
};

/**
 * The fields of a machine model (ST-006, on shadcn's Field since ST-036) – shared by creating and correcting it. They
 * show what was typed after a rejection, else the given details (the correction's current model, nothing when
 * creating), and mark the field that caused the rejection, linked to its reason (G8).
 *
 * Which technologies fit which machine category is shown in each technology's label, not by hiding the ones that
 * do not fit: without JavaScript nothing can be filtered in the browser, and the command rejects a combination that
 * does not fit (AGG-MachineModel's invariant) with its own reason. Every technology appears exactly once – two
 * options with the same value would make the browser echo the first one after a rejection.
 */
export function MachineModelFields({
  categories,
  technologies,
  given,
  rejection,
  kept,
  rejectionId,
}: Choices & {
  given?: Omit<MachineModel, "id">;
  rejection?: { error: string; values: Partial<Record<MachineModelField, string>> };
  /** `keptKey(state)` – fields keyed on it keep the typed value through React's form reset. */
  kept: string;
  rejectionId: string;
}) {
  const invalid = rejection ? fieldOf[rejection.error as CorrectMachineModelError] : undefined;
  const value = (field: MachineModelField, fallback: string | undefined) =>
    rejection ? (rejection.values[field] ?? "") : (fallback ?? "");
  const marked = (field: MachineModelField) => ({
    id: field,
    name: field,
    "aria-invalid": invalid === field || undefined,
    "aria-describedby": invalid === field ? rejectionId : undefined,
  });

  return (
    <>
      <Field data-invalid={invalid === "title"}>
        <FieldLabel htmlFor="title">{texts.modelTitle}</FieldLabel>
        <Input key={`title-${kept}`} {...marked("title")} defaultValue={value("title", given?.title)} required />
      </Field>
      <Field data-invalid={invalid === "manufacturer"}>
        <FieldLabel htmlFor="manufacturer">{texts.manufacturer}</FieldLabel>
        <Input
          key={`manufacturer-${kept}`}
          {...marked("manufacturer")}
          defaultValue={value("manufacturer", given?.manufacturer)}
          required
        />
      </Field>
      <Field data-invalid={invalid === "year"}>
        <FieldLabel htmlFor="year">{texts.year}</FieldLabel>
        <Input
          key={`year-${kept}`}
          {...marked("year")}
          inputMode="numeric"
          defaultValue={value("year", given?.year?.toString())}
        />
      </Field>
      <Field data-invalid={invalid === "machineCategory"}>
        <FieldLabel htmlFor="machineCategory">{terms["Machine category"]}</FieldLabel>
        <NativeSelect
          key={`machineCategory-${kept}`}
          {...marked("machineCategory")}
          defaultValue={value("machineCategory", given?.machineCategory)}
          required
        >
          <option value="">{texts.choose}</option>
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field data-invalid={invalid === "technology"}>
        <FieldLabel htmlFor="technology">{terms.Technology}</FieldLabel>
        <NativeSelect
          key={`technology-${kept}`}
          {...marked("technology")}
          defaultValue={value("technology", given?.technology)}
        >
          <option value="">{texts.noTechnology}</option>
          {technologies.map((technology) => (
            <option key={technology.value} value={technology.value}>
              {technology.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </>
  );
}
