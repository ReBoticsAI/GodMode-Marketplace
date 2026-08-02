/**
 * Seller intake gates for installType: "plugin" catalog entries
 * (GodMode-Marketplace#3). Shared by validate-catalog and unit tests.
 */

export const FLOATING_PLUGIN_REFS = new Set([
  "",
  "main",
  "master",
  "head",
  "origin/main",
  "origin/master",
]);

const PUBLIC_GITHUB_REPO =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

const ACTIONS_RUN_URL =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/\d+\/?$/;

const HEX_DIGEST = /^[0-9a-f]{7,64}$/i;

/**
 * @param {string | undefined | null} ref
 */
export function normalizePluginRef(ref) {
  return String(ref ?? "").trim();
}

/**
 * @param {string | undefined | null} ref
 */
export function isFloatingPluginRef(ref) {
  return FLOATING_PLUGIN_REFS.has(normalizePluginRef(ref).toLowerCase());
}

/**
 * @param {string | undefined | null} repo
 */
export function isPublicGithubPluginRepo(repo) {
  return PUBLIC_GITHUB_REPO.test(String(repo ?? "").trim());
}

/**
 * @param {string | undefined | null} url
 */
export function isActionsRunUrl(url) {
  return ACTIONS_RUN_URL.test(String(url ?? "").trim());
}

/**
 * @param {{
 *   id?: string,
 *   installType?: string,
 *   pluginRepo?: string,
 *   pluginRef?: string,
 *   pluginDigest?: string,
 *   artifactSha256?: string,
 *   ciRunUrl?: string,
 * }} entry
 * @param {{ requireVerifyProof?: boolean }} [opts]
 * @returns {string[]} error messages (empty if ok)
 */
export function collectPluginSubmissionErrors(entry, opts = {}) {
  const requireVerifyProof = opts.requireVerifyProof === true;
  const errors = [];
  if (entry.installType !== "plugin") return errors;

  const id = entry.id ?? "(unknown)";
  const repo = String(entry.pluginRepo ?? "").trim();
  const ref = normalizePluginRef(entry.pluginRef);

  if (!repo) {
    errors.push(`${id}: pluginRepo is required`);
  } else if (!isPublicGithubPluginRepo(repo)) {
    errors.push(
      `${id}: pluginRepo must be a public https://github.com/owner/repo URL (no .git suffix)`
    );
  }

  if (!ref) {
    errors.push(`${id}: pluginRef is required (tag or commit SHA)`);
  } else if (isFloatingPluginRef(ref)) {
    errors.push(
      `${id}: pluginRef must be an immutable tag or commit SHA (not main/master/HEAD)`
    );
  }

  const digest = String(entry.pluginDigest ?? "").trim();
  if (digest && !HEX_DIGEST.test(digest)) {
    errors.push(`${id}: pluginDigest must be a hex commit SHA`);
  }

  const artifact = String(entry.artifactSha256 ?? "").trim();
  if (artifact && !/^[0-9a-f]{64}$/i.test(artifact)) {
    errors.push(`${id}: artifactSha256 must be a 64-char hex digest`);
  }

  const ciRunUrl = String(entry.ciRunUrl ?? "").trim();
  if (ciRunUrl && !isActionsRunUrl(ciRunUrl)) {
    errors.push(
      `${id}: ciRunUrl must be a GitHub Actions run URL (…/actions/runs/<id>)`
    );
  }

  if (requireVerifyProof && !ciRunUrl) {
    errors.push(
      `${id}: ciRunUrl is required (link a green reusable-plugin-verify run for this pluginRef)`
    );
  }

  return errors;
}

/**
 * @param {object} entry
 * @param {{ requireVerifyProof?: boolean }} [opts]
 */
export function assertPluginSubmissionGate(entry, opts = {}) {
  const errors = collectPluginSubmissionErrors(entry, opts);
  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}
