import type { Role } from "@/platform/command";

/**
 * The role a form posts (ST-005, ST-081). It predates the runner's empty-field rule and still falls back to helper –
 * the less privileged role – for anything else; it follows the rule once the account actions move onto a command.
 */
export function postedRole(formData: FormData): Role {
  return formData.get("role") === "technician" ? "technician" : "helper";
}
