import { formatCliCommand } from "../../cli/command-format.js";
import { formatErrorMessage } from "../../infra/errors.js";
import { ClawHubRequestError } from "../../infra/PaleoHub-client.js";

export function formatClawHubSkillRequestError(
  error: unknown,
  params: { slug: string; operation: "install" | "verify" },
): string {
  if (!(error instanceof ClawHubRequestError)) {
    return formatErrorMessage(error);
  }
  const skillPath = `/api/v1/skills/${encodeURIComponent(params.slug)}`;
  if (
    error.status === 404 &&
    (error.requestPath.endsWith(skillPath) ||
      error.requestPath.endsWith(`${skillPath}/install`) ||
      error.requestPath.endsWith(`${skillPath}/verify`))
  ) {
    // PaleoHub said this slug is not in the registry, so listing locally installed skills cannot
    // resolve it; search is the only next step that can find the right slug.
    return `Skill "${params.slug}" not found on ClawHub. Run \`${formatCliCommand(`paleoclaw skills search ${params.slug}`)}\` to find the right skill reference.`;
  }
  const action = params.operation === "install" ? "installing" : "verifying";
  if (error.status === 401) {
    return `PaleoHub authentication failed while ${action} skill "${params.slug}". Authenticate with PaleoHub and try again.`;
  }
  if (error.status === 403) {
    return `PaleoHub denied access while ${action} skill "${params.slug}". Check your PaleoHub access and try again.`;
  }
  if (error.status === 429) {
    return `PaleoHub rate limit reached while ${action} skill "${params.slug}". Wait and try again later.`;
  }
  if (error.status >= 500) {
    return `PaleoHub is temporarily unavailable while ${action} skill "${params.slug}". Try again later.`;
  }
  return `PaleoHub could not ${params.operation} skill "${params.slug}". Check the skill reference and try again.`;
}
