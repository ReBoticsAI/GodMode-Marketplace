import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const json = async (relativePath) =>
  JSON.parse(await readFile(path.join(root, relativePath), "utf8"));

const packPaths = [
  "packs/research-agent-pack/bundle.json",
  "packs/work-starter-pack/bundle.json",
  "packs/productivity-skills-pack/bundle.json",
];

test("catalog and pack manifests publish the same versions", async () => {
  const catalog = await json("catalog/index.json");
  assert.equal(catalog.version, 2);

  for (const entry of catalog.entries.filter(({ installType }) => installType === "clone")) {
    const manifest = await json(`packs/${entry.id}/manifest.json`);
    assert.equal(entry.version, "1.1.0");
    assert.equal(manifest.version, entry.version);
  }
});

test("all pack children are kernel Record payloads", async () => {
  for (const packPath of packPaths) {
    const bundle = await json(packPath);
    assert.equal(bundle.version, 1);
    assert.equal(bundle.kind, "bundle");

    for (const child of bundle.data.children) {
      assert.equal(child.kind, "record");
      assert.deepEqual(Object.keys(child.data), ["record"]);
      const { record } = child.data;
      assert.match(record.id, /^[a-z0-9][a-z0-9-]*$/);
      assert.ok(["StructureNode", "Agent", "Skill"].includes(record.objectType));
      assert.equal(record.data.id, record.id);
      assert.equal(child.sourceId, record.id);
      assert.equal(typeof record.data, "object");
      assert.ok(!Array.isArray(record.data));
    }
  }
});

test("work starter pack is a parent-first StructureNode tree", async () => {
  const bundle = await json("packs/work-starter-pack/bundle.json");
  const records = bundle.data.children.map(({ data }) => data.record);
  assert.deepEqual(
    records.map(({ id }) => id),
    ["work", "work-projects", "work-projects-sample-project"]
  );
  assert.ok(records.every(({ objectType }) => objectType === "StructureNode"));
  assert.deepEqual(
    records.map(({ data }) => data.parent_id),
    [null, "work", "work-projects"]
  );
  assert.equal(records[2].data.kind, "placeholder");
  assert.ok(records.every(({ data }) => !("sort_order" in data)));
});

test("Agent and Skill records use Record API value types", async () => {
  const bundles = await Promise.all([
    json("packs/research-agent-pack/bundle.json"),
    json("packs/productivity-skills-pack/bundle.json"),
  ]);
  const records = bundles.flatMap(({ data }) =>
    data.children.map((child) => child.data.record)
  );
  const agent = records.find(({ objectType }) => objectType === "Agent");
  const skills = records.filter(({ objectType }) => objectType === "Skill");

  assert.ok(agent);
  assert.equal(typeof agent.data.enabled, "boolean");
  assert.equal(skills.length, 3);
  for (const skill of skills) {
    assert.equal(typeof skill.data.enabled, "boolean");
    assert.ok(Array.isArray(skill.data.tools_json));
    assert.ok(Array.isArray(skill.data.departments_json));
  }
});

test("packs contain no legacy persistence envelopes or retired route strings", async () => {
  const retiredRoutes = [
    ["/api", "departments"],
    ["/api", "divisions"],
    ["/api", "structure"],
    ["/api", "ai", "agents"],
    ["/api", "ai", "skills"],
  ].map((parts) => parts.join("/"));

  for (const packPath of packPaths) {
    const source = await readFile(path.join(root, packPath), "utf8");
    const parsed = JSON.parse(source);
    assert.ok(!source.includes('"kind": "department"'));
    assert.ok(!source.includes('"kind": "agent"'));
    assert.ok(!source.includes('"kind": "skill"'));
    assert.ok(!source.includes('"department":'));
    assert.ok(!source.includes('"agent":'));
    assert.ok(!source.includes('"skill":'));
    for (const route of retiredRoutes) assert.ok(!source.includes(route));
    assert.ok(parsed.data.children.every(({ kind }) => kind === "record"));
  }
});
