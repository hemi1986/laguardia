import { removeLogoCommand, replaceLogoCommand, type LogoMediaType, type RemoveLogoError } from "@/modules/collection";
import type { FormFields, FormState } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";
import type { LogoError } from "@/photo";
import type { CommandError } from "@/platform/command";

/** The form „Logo“'s own fields (ST-102): only the version of the logo it showed – the image is the file field `logo`. */
export const logoFormFields = ["version"] as const;

export type LogoFormField = (typeof logoFormFields)[number];

/** The file field of the upload – posted as chosen, without the browser's photo preparation (ST-102). */
export const LOGO_FIELD = "logo";

/** The command each part of the form runs – named here, so the actions and their tests run the same ones. */
export const uploadLogoCommand = replaceLogoCommand;
export { removeLogoCommand };

/**
 * How the upload of the form „Logo“ is read (ST-102): the logo version the page showed and the logo as the photo module
 * accepted and stored it – what its Server Action runs and its tests post through.
 */
export const logoFormDefinition = {
  fields: logoFormFields,
  logo: { field: LOGO_FIELD },
  input: (fields: FormFields<LogoFormField>, logo: { name: string; contentType: string }) => ({
    version: versionSeen(fields.version),
    // The logo acceptance only gives these three (invariant: a PNG, JPEG or WebP image).
    logo: { name: logo.name, contentType: logo.contentType as LogoMediaType },
  }),
} as const;

/** How the removal of the logo is read (ST-102): one tap, only the logo version the page showed. */
export const removeLogoFormDefinition = {
  fields: logoFormFields,
  input: (fields: FormFields<LogoFormField>) => ({ version: versionSeen(fields.version) }),
} as const;

export type UploadLogoState = FormState<CommandError<typeof replaceLogoCommand> | LogoError, LogoFormField>;
export type RemoveLogoState = FormState<CommandError<typeof removeLogoCommand> | RemoveLogoError, LogoFormField>;
