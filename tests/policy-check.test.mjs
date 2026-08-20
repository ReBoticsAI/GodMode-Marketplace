import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  POLICY_CHECK_VERSION,
  collectBlocklistHits,
  entrySearchText,
  runLlmPolicyGate,
  runPolicyCheck,
  textMatchesTerm,
} from "../scripts/policy-check.mjs";
import blocklist from "../policy/blocklist.json" with { type: "json" };

test("POLICY_CHECK_VERSION is set", () => {
  assert.equal(POLICY_CHECK_VERSION, "1");
});

test("textMatchesTerm matches whole words and phrases", () => {
  assert.equal(textMatchesTerm("Casino helper pack", "casino"), true);
  assert.equal(textMatchesTerm("my-casino-bot", "casino"), true);
  assert.equal(textMatchesTerm("cascade tools", "casino"), false);
  assert.equal(textMatchesTerm("Online betting tips", "online betting"), true);
});

test("collectBlocklistHits flags gambling titles", () => {
  const hits = collectBlocklistHits(blocklist, {
    id: "fun-pack",
    title: "Casino Helper",
    description: "Harmless tools",
    tags: ["tools"],
  });
  assert.ok(hits.some((h) => h.categoryId === "gambling" && h.term === "casino"));
});

test("collectBlocklistHits flags malware in description", () => {
  const hits = collectBlocklistHits(blocklist, {
    id: "ops-tool",
    title: "Ops",
    description: "Includes a phishing kit demo",
    tags: [],
  });
  assert.ok(hits.some((h) => h.categoryId === "malware_fraud"));
});

test("clean plugin, clone, and live entries pass the blocklist", () => {
  const clean = [
    {
      id: "workspace-pulse",
      installType: "plugin",
      title: "Workspace Pulse",
      description: "Health ping tool",
      tags: ["community", "health"],
    },
    {
      id: "weekly-review",
      installType: "clone",
      deliveryMode: "clone",
      title: "Weekly review pack",
      description: "Clone skill pack",
      tags: ["productivity"],
    },
    {
      id: "live-share-smoke",
      installType: "clone",
      deliveryMode: "live",
      title: "Live Share Smoke",
      description: "Bind a matching skill export",
      tags: ["community", "live", "smoke"],
    },
  ];
  for (const entry of clean) {
    assert.deepEqual(collectBlocklistHits(blocklist, entry), [], entrySearchText(entry));
  }
});

test("LLM gate skips by default and fails closed when enabled without provider", async () => {
  const prev = process.env.POLICY_LLM_ENABLED;
  delete process.env.POLICY_LLM_ENABLED;
  const skipped = await runLlmPolicyGate([]);
  assert.equal(skipped.status, "skipped");

  process.env.POLICY_LLM_ENABLED = "1";
  const enabled = await runLlmPolicyGate([]);
  assert.equal(enabled.status, "fail");

  if (prev === undefined) delete process.env.POLICY_LLM_ENABLED;
  else process.env.POLICY_LLM_ENABLED = prev;
});

test("runPolicyCheck fails closed on a prohibited community catalog", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gm-policy-"));
  try {
    const catalogPath = path.join(dir, "index.json");
    await writeFile(
      catalogPath,
      JSON.stringify({
        version: 2,
        entries: [
          {
            id: "evil-casino-bot",
            installType: "plugin",
            title: "Casino Bot",
            description: "Sports betting helper",
            tags: ["gambling"],
          },
        ],
      })
    );
    const audit = await runPolicyCheck({
      communityCatalogPath: catalogPath,
      writeGithubSummary: false,
    });
    assert.equal(audit.result, "fail");
    assert.ok(audit.violationCount >= 1);
    assert.equal(audit.policyCheckVersion, "1");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runPolicyCheck passes the real community catalog", async () => {
  const audit = await runPolicyCheck({ writeGithubSummary: false });
  assert.equal(audit.result, "pass");
  assert.equal(audit.llm.status, "skipped");
  assert.ok(audit.entryCount >= 1);
});
