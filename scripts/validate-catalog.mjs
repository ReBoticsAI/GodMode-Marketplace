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

const catalog = await json("catalog/index.json");
assert(
  validateIndex(catalog),
  `catalog/index.json failed schema validation:\n${ajv.errorsText(validateIndex.errors, {
    separator: "\n",
  })}`
);

const ids = catalog.entries.map((entry) => entry.id);
assert.equal(new Set(ids).size, ids.length, "catalog entry ids must be unique");

for (const entry of catalog.entries) {
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
    assertPluginSubmissionGate(entry, { requireVerifyProof });
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
    `${entry.bundlePath} failed schema validation:\n${ajv.errorsText(
      validateBundle.errors,
      { separator: "\n" }
    )}`
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

const pluginCount = catalog.entries.filter((entry) => entry.installType === "plugin").length;
console.log(
  `Validated ${catalog.entries.length} catalog entries (${pluginCount} plugins, pin gate on` +
    `${requireVerifyProof ? ", verify-proof required" : ""}), and ${
      catalog.entries.filter((entry) => entry.installType === "clone").length
    } kernel-native packs.`
);
