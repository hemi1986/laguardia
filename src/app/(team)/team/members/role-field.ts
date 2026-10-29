import type { Role } from "@/platform/command";

/**
 * The role the form creating a team member posts (ST-005, ST-081). It predates the runner's empty-field rule and still falls back to helper –
 * the less privileged role – for anything else; the account edit page follows the rule (ST-088).
 */
export function postedRole(formData: FormData): Role {
  return formData.get("role") === "technician" ? "technician" : "helper";
}
