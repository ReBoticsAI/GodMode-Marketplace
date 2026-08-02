import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPluginSubmissionGate,
  collectPluginSubmissionErrors,
  isFloatingPluginRef,
  isPublicGithubPluginRepo,
} from "../scripts/plugin-submission-gate.mjs";

const pinned = {
  id: "sample-plugin",
  installType: "plugin",
  pluginRepo: "https://github.com/example/sample-plugin",
  pluginRef: "a1b2c3d4e5f6789012345678901234567890abcd",
  pluginDigest: "a1b2c3d4e5f6789012345678901234567890abcd",
  ciRunUrl: "https://github.com/example/sample-plugin/actions/runs/123456789",
};

test("rejects floating pluginRef values", () => {
  assert.equal(isFloatingPluginRef("main"), true);
  assert.equal(isFloatingPluginRef("master"), true);
  assert.equal(isFloatingPluginRef("HEAD"), true);
  assert.equal(isFloatingPluginRef(""), true);
  assert.equal(isFloatingPluginRef(pinned.pluginRef), false);
  assert.equal(isFloatingPluginRef("v1.2.3"), false);
});

test("requires public github.com pluginRepo URLs", () => {
  assert.equal(isPublicGithubPluginRepo(pinned.pluginRepo), true);
  assert.equal(isPublicGithubPluginRepo("https://gitlab.com/example/sample"), false);
  assert.equal(isPublicGithubPluginRepo("git@github.com:example/sample.git"), false);
});

test("pin gate rejects main without verify proof mode", () => {
  const errors = collectPluginSubmissionErrors({
    ...pinned,
    pluginRef: "main",
    ciRunUrl: undefined,
  });
  assert.ok(errors.some((e) => /immutable tag or commit SHA/.test(e)));
});

test("strict verify mode requires ciRunUrl", () => {
  const errors = collectPluginSubmissionErrors(
    { ...pinned, ciRunUrl: undefined },
    { requireVerifyProof: true }
  );
  assert.ok(errors.some((e) => /ciRunUrl is required/.test(e)));
});

test("assertPluginSubmissionGate accepts a pinned verified entry", () => {
  assert.doesNotThrow(() =>
    assertPluginSubmissionGate(pinned, { requireVerifyProof: true })
  );
});

test("clone entries skip the plugin gate", () => {
  assert.deepEqual(
    collectPluginSubmissionErrors({
      id: "work-starter-pack",
      installType: "clone",
      bundlePath: "packs/work-starter-pack/bundle.json",
    }),
    []
  );
});
