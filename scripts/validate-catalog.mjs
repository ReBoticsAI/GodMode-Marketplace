import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { assertPluginSubmissionGate } from "./plugin-submission-gate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = async (relativePath) =>
  JSON.parse(await readFile(path.join(root, relativePath), "utf8"));

/** Set MARKETPLACE_REQUIRE_PLUGIN_CI=1 to fail closed when plugin entries lack ciRunUrl. */
const requireVerifyProof = process.env.MARKETPLACE_REQUIRE_PLUGIN_CI === "1";

const entrySchema = await json("schemas/catalog-entry.schema.json");
const indexSchema = await json("schemas/catalog-index.schema.json");
const bundleSchema = await json("schemas/portable-bundle.schema.json");

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(entrySchema);
const validateIndex = ajv.compile(indexSchema);
const validateBundle = ajv.compile(bundleSchema);

async function validateCatalogFile(relativePath, { requireLocalArtifacts }) {
  const catalog = await json(relativePath);
  assert(
    validateIndex(catalog),
    `${relativePath} failed schema validation:\n${ajv.errorsText(validateIndex.errors, {
      separator: "\n",
    })}`
  );

  const ids = catalog.entries.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, `${relativePath}: catalog entry ids must be unique`);

  for (const entry of catalog.entries) {
    if (entry.installType === "plugin") {
      assertPluginSubmissionGate(entry, { requireVerifyProof });
    }

    if (!requireLocalArtifacts) continue;

    const manifest = await json(
      `${entry.installType === "clone" ? "packs" : "plugins"}/${entry.id}/manifest.json`
    );
    assert.equal(manifest.id, entry.id, `${entry.id}: manifest id must match catalog`);
    assert.equal(
      manifest.version,
      entry.version,
      `${entry.id}: manifest and catalog versions must match`
    );
    assert.equal(manifest.kind, entry.kind, `${entry.id}: manifest kind must match catalog`);

    if (entry.installType === "plugin") {
      assert.equal(
        manifest.pluginRepo,
        entry.pluginRepo,
        `${entry.id}: manifest pluginRepo must match catalog`
      );
      assert.equal(
        manifest.pluginRef,
        entry.pluginRef,
        `${entry.id}: manifest pluginRef must match catalog`
      );
      if (entry.pluginDigest !== undefined) {
        assert.equal(
          manifest.pluginDigest,
          entry.pluginDigest,
          `${entry.id}: manifest pluginDigest must match catalog`
        );
      }
      continue;
    }

    const bundle = await json(entry.bundlePath);
    assert(
      validateBundle(bundle),
      `${entry.bundlePath} failed schema validation:\n${ajv.errorsText(validateBundle.errors, {
        separator: "\n",
      })}`
    );
    assert.equal(bundle.sourceId, entry.id, `${entry.id}: bundle sourceId must match catalog`);

    for (const child of bundle.data.children) {
      const { record } = child.data;
      assert.equal(record.id, child.sourceId, `${entry.id}: record id must match sourceId`);
      assert.equal(
        record.data.id,
        record.id,
        `${entry.id}: Record.data.id must match Record.id`
      );
    }
  }

  const pluginCount = catalog.entries.filter((entry) => entry.installType === "plugin").length;
  const cloneCount = catalog.entries.filter((entry) => entry.installType === "clone").length;
  const liveCount = catalog.entries.filter((entry) => entry.deliveryMode === "live").length;
  for (const entry of catalog.entries) {
    if (entry.deliveryMode === "live") {
      assert.equal(
        entry.installType,
        "clone",
        `${entry.id}: deliveryMode live requires installType clone`
      );
      assert.ok(entry.bundlePath, `${entry.id}: deliveryMode live requires bundlePath`);
      assert.ok(entry.pluginRepo, `${entry.id}: deliveryMode live requires pluginRepo`);
      assert.ok(entry.pluginRef, `${entry.id}: deliveryMode live requires pluginRef`);
    }
  }
  console.log(
    `Validated ${relativePath}: ${catalog.entries.length} entries (${pluginCount} plugins, ${cloneCount} packs, ${liveCount} live` +
      `${requireVerifyProof ? ", verify-proof required" : ""})`
  );
  return catalog;
}

const official = await validateCatalogFile("catalog/official/index.json", {
  requireLocalArtifacts: true,
});
const community = await validateCatalogFile("catalog/community/index.json", {
  // Community listings may start as index-only rows; local packs/plugins optional until mirrored.
  requireLocalArtifacts: false,
});

// Legacy path: must match Official so old MARKETPLACE_OFFICIAL_URL keep working.
const legacy = await json("catalog/index.json");
assert.deepEqual(
  legacy.entries.map((e) => e.id).sort(),
  official.entries.map((e) => e.id).sort(),
  "catalog/index.json must stay in sync with catalog/official/index.json (legacy Official URL)"
);

// Legacy Unofficial path: must match Community so old MARKETPLACE_UNOFFICIAL_URL keep working.
const unofficial = await json("catalog/unofficial/index.json");
assert.deepEqual(
  unofficial.entries.map((e) => e.id).sort(),
  community.entries.map((e) => e.id).sort(),
  "catalog/unofficial/index.json must stay in sync with catalog/community/index.json (legacy Community URL)"
);

const retiredRouteFragments = [
  ["/api", "departments"],
  ["/api", "divisions"],
  ["/api", "structure"],
  ["/api", "ai", "agents"],
  ["/api", "ai", "skills"],
].map((parts) => parts.join("/"));
const scanRoots = ["catalog", "packs", "plugins"];

async function textFiles(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await textFiles(relative)));
    else if (/\.(?:json|md|mjs|js|ts|tsx|ya?ml)$/.test(entry.name)) files.push(relative);
  }
  return files;
}

const scannedFiles = [
  ...(await Promise.all(scanRoots.map(textFiles))).flat(),
  "README.md",
  "CONTRIBUTING.md",
];
for (const file of scannedFiles) {
  const source = await readFile(path.join(root, file), "utf8");
  for (const route of retiredRouteFragments) {
    assert(!source.includes(route), `${file} contains retired mutation route ${route}`);
  }
}

console.log(
  "Dual catalog layout OK (official + community; legacy Official and Unofficial indexes synced)."
);
