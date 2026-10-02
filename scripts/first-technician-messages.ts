import type { FirstTechnicianOutcome } from "@/modules/team";

type Rejection = Extract<FirstTechnicianOutcome, { ok: false }>["error"];

/** What the first-technician setup says when the Team module refuses – the interactive script and ST-083's seed. */
export function firstTechnicianRefusal(error: Rejection): string {
  return {
    "name-required": "The name must not be empty – nothing was created.",
    "username-invalid": "The username needs 3–30 characters: letters a–z, digits, _ and . – nothing was created.",
    "password-too-short": "The password must have at least 10 characters – nothing was created.",
    "accounts-exist": "Team member accounts exist already – nothing was created or changed.",
  }[error];
}
