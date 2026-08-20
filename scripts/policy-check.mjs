/**
 * Community catalog policy check (GodMode #598).
 * Deterministic blocklist first; optional LLM gate stub (POLICY_LLM_ENABLED=1).
 */

import { readFile, appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const POLICY_CHECK_VERSION = "1";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string} haystack
 * @param {string} term
 */
export function textMatchesTerm(haystack, term) {
  const h = String(haystack ?? "").toLowerCase();
  const t = String(term ?? "").trim().toLowerCase();
  if (!t) return false;
  if (t.includes(" ")) {
    return h.includes(t);
  }
  // Whole-word-ish for single tokens (kebab ids and prose).
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
  return re.test(h);
}

/**
 * @param {unknown} entry
 * @returns {string}
 */
export function entrySearchText(entry) {
  if (!entry || typeof entry !== "object") return "";
  const e = /** @type {Record<string, unknown>} */ (entry);
  const tags = Array.isArray(e.tags) ? e.tags.map(String).join(" ") : "";
  return [e.id, e.title, e.description, tags].map((x) => String(x ?? "")).join("\n");
}

/**
 * @param {{ categories?: Array<{ id?: string, label?: string, terms?: string[] }> }} blocklist
 * @param {unknown} entry
 * @returns {Array<{ categoryId: string, categoryLabel: string, term: string, fieldHint: string }>}
 */
export function collectBlocklistHits(blocklist, entry) {
  const hits = [];
  const text = entrySearchText(entry);
  const id = String(/** @type {Record<string, unknown>} */ (entry)?.id ?? "(unknown)");
  for (const cat of blocklist.categories ?? []) {
    const categoryId = String(cat.id ?? "unknown");
    const categoryLabel = String(cat.label ?? categoryId);
    for (const term of cat.terms ?? []) {
      if (textMatchesTerm(text, term)) {
        hits.push({
          categoryId,
          categoryLabel,
          term: String(term),
          fieldHint: id,
        });
      }
    }
  }
  return hits;
}

/**
 * LLM policy gate placeholder. No provider call until POLICY_LLM_ENABLED=1
 * and a model/prompt are chosen (requires a future API secret).
 *
 * @param {unknown[]} _entries
 * @returns {Promise<{ status: "skipped" | "pass" | "flag" | "fail", detail: string }>}
 */
export async function runLlmPolicyGate(_entries) {
  if (process.env.POLICY_LLM_ENABLED !== "1") {
    return {
      status: "skipped",
      detail: "LLM policy gate disabled (set POLICY_LLM_ENABLED=1 when a provider is configured).",
    };
  }
  // Extension point: call provider with README/manifest snippets + catalog metadata.
  // Fail closed for now so enabling the flag without an implementation cannot silently pass.
  return {
    status: "fail",
    detail:
      "POLICY_LLM_ENABLED=1 but no LLM provider is wired yet. Disable the flag or implement the provider call.",
  };
}

/**
 * @param {{
 *   communityCatalogPath?: string,
 *   blocklistPath?: string,
 *   writeGithubSummary?: boolean,
 * }} [opts]
 */
export async function runPolicyCheck(opts = {}) {
  const communityCatalogPath =
    opts.communityCatalogPath ?? path.join(root, "catalog/community/index.json");
  const blocklistPath = opts.blocklistPath ?? path.join(root, "policy/blocklist.json");

  const blocklist = JSON.parse(await readFile(blocklistPath, "utf8"));
  const catalog = JSON.parse(await readFile(communityCatalogPath, "utf8"));
  const entries = Array.isArray(catalog.entries) ? catalog.entries : [];

  /** @type {Array<{ entryId: string, installType: string, deliveryMode: string, hits: ReturnType<typeof collectBlocklistHits> }>} */
  const violations = [];
  for (const entry of entries) {
    const hits = collectBlocklistHits(blocklist, entry);
    if (hits.length) {
      violations.push({
        entryId: String(entry.id ?? "(unknown)"),
        installType: String(entry.installType ?? ""),
        deliveryMode: String(entry.deliveryMode ?? "clone"),
        hits,
      });
    }
  }

  const llm = await runLlmPolicyGate(entries);
  const blocklistOk = violations.length === 0;
  const llmOk = llm.status === "skipped" || llm.status === "pass";
  const ok = blocklistOk && llmOk;

  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  const repo = process.env.GITHUB_REPOSITORY || "";
  const runId = process.env.GITHUB_RUN_ID || "";
  const resultUrl =
    repo && runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : null;

  const audit = {
    policyCheckVersion: POLICY_CHECK_VERSION,
    blocklistVersion: blocklist.version ?? null,
    result: ok ? "pass" : "fail",
    entryCount: entries.length,
    violationCount: violations.length,
    violations,
    llm,
    resultUrl,
  };

  if (opts.writeGithubSummary !== false && process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      `## Marketplace policy check (v${POLICY_CHECK_VERSION})`,
      "",
      `- Result: **${audit.result}**`,
      `- Entries scanned: ${audit.entryCount}`,
      `- Blocklist violations: ${audit.violationCount}`,
      `- LLM gate: ${llm.status} (${llm.detail})`,
      resultUrl ? `- Run URL: ${resultUrl}` : "- Run URL: (local)",
      "",
    ];
    if (violations.length) {
      lines.push("### Violations", "");
      for (const v of violations) {
        const terms = v.hits.map((h) => `${h.categoryId}:${h.term}`).join(", ");
        lines.push(
          `- \`${v.entryId}\` (${v.installType}, deliveryMode=${v.deliveryMode}): ${terms}`
        );
      }
      lines.push("");
    }
    await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"));
  }

  return audit;
}

async function main() {
  const audit = await runPolicyCheck();
  console.log(JSON.stringify(audit, null, 2));

  if (process.env.GITHUB_WORKSPACE) {
    const outDir = path.join(process.env.GITHUB_WORKSPACE, "policy-out");
    await mkdir(outDir, { recursive: true });
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path.join(outDir, "policy-check.json"), JSON.stringify(audit, null, 2));
  }

  if (audit.result !== "pass") {
    console.error(
      `policy-check failed: ${audit.violationCount} blocklist violation(s); llm=${audit.llm.status}`
    );
    process.exitCode = 1;
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
