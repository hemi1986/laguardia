import { execFileSync } from "node:child_process";

/** Everything in the repository but the discovery artifacts, the tooling and the generated migrations. */
const notScanned = /^(docs|\.claude|drizzle)\/|\.(png|jpe?g|ico|webp|svg|woff2?)$/;

/**
 * The files a repository scan reads (seam catalog: "a rule over the whole repository that neither lint nor the type
 * check reads"): tracked files and new ones not yet added – the ignored ones (.env files, node_modules, .next)
 * excluded – without docs/, .claude/ and drizzle/. The scan's own file is left out, it names what it looks for.
 */
export function repositoryFiles(scanFile: string): string[] {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
    .split("\n")
    .filter((file) => file && file !== scanFile && !notScanned.test(file));
}
