import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { definePrivilegedContracts, definePrivilegedHandlers, z } from "@hatch/space-sdk";

// Reads files from the applicant's job-search data folder
// (~/workspace/job-search) so the dashboard can display the ledger and the
// tailored package documents (resumes, cover letters, PACKAGE.md notes)
// that live there. Paths are workspace-relative and validated: no absolute
// paths, no "..", and nothing outside the applicant's job-search data
// folder. The folder name ("job-search") is configurable per applicant —
// the validation prefix below must match the folder name chosen in the
// applicant's data kit.
export const privileged = definePrivilegedContracts({
  readWorkspaceFile: {
    request: z.object({ relPath: z.string().min(1).max(300) }),
    response: z.object({
      found: z.boolean(),
      base64: z.string().nullable(),
      text: z.string().nullable(),
      byteLength: z.number(),
    }),
    capabilities: ["filesystem.read"],
    timeoutMs: 30_000,
  },
});

const WORKSPACE_ROOT = "/home/hatch/workspace";

export const privilegedHandlers = definePrivilegedHandlers(privileged, {
  async readWorkspaceFile(args) {
    const rel = normalize(args.relPath);
    if (
      rel.startsWith("/") ||
      rel.startsWith("..") ||
      rel.includes("/../") ||
      !rel.startsWith("job-search/")
    ) {
      return { found: false, base64: null, text: null, byteLength: 0 };
    }
    try {
      const bytes = await readFile(join(WORKSPACE_ROOT, rel));
      const isText =
        rel.endsWith(".md") || rel.endsWith(".txt");
      return {
        found: true,
        base64: isText ? null : bytes.toString("base64"),
        text: isText ? bytes.toString("utf8") : null,
        byteLength: bytes.byteLength,
      };
    } catch {
      return { found: false, base64: null, text: null, byteLength: 0 };
    }
  },
});
