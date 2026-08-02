# Contributing to GodMode Marketplace

## PR checklist

- [ ] Entry added to `catalog/index.json` with unique `id`
- [ ] Local `manifest.json` id, kind, and version match the catalog entry
- [ ] Clone entry has a version-1 `kind: "bundle"` `bundle.json` at `bundlePath`
- [ ] Every bundle child is a version-1 `kind: "record"` envelope whose only data member is `record`
- [ ] Every Record has `id`, `objectType`, and `data`; Record `data.id`, Record `id`, and child `sourceId` match
- [ ] Records use current kernel value shapes, not legacy table/envelope shapes or retired mutation routes
- [ ] Parent/dependency Records precede children that reference them
- [ ] Plugin source is a **public** GitHub repo with a valid `godmode.plugin.json`; executable Bridge/web plugins declare `kernelApiVersion: 1` and use `api.kernel`
- [ ] Plugin catalog, local manifest, and source `godmode.plugin.json` versions are coordinated
- [ ] Plugin `pluginRef` is an **immutable tag or commit SHA** (not `main` / `master` / `HEAD`)
- [ ] Plugin entry links a **green** reusable verify run via `ciRunUrl` for that same ref (see seller intake below)
- [ ] Optional: `pluginDigest` (full commit SHA) and `artifactSha256` from the verify workflow outputs
- [ ] No secrets, API keys, or operator-specific content
- [ ] Title and description are clear for OSS users
- [ ] Tags help browse/filter (e.g. `work`, `agents`, `skills`)

The `manifest.json` beside a pack or plugin in this repository is catalog
metadata, not the plugin runtime manifest. Runtime fields such as
`kernelApiVersion`, `bridge`, `web`, `objectTypes`, and `records` belong in the
referenced source repository's `godmode.plugin.json`.

## Seller intake (plugin verify)

Community and Official **plugin** listings must pass verification-time isolation
on GitHub Actions before merge:

1. Add the reusable workflow caller to the plugin repo (copy
   [`examples/seller-plugin-verify.yml`](examples/seller-plugin-verify.yml) to
   `.github/workflows/plugin-verify.yml`).
2. Pin `uses:` to a Marketplace commit/tag and set `godmode_ref` to the GodMode
   core release you tested against.
3. Cut a release tag (or push the commit you will list) and confirm the verify
   job is green.
4. Open a Marketplace PR with `pluginRef` set to that tag or commit SHA,
   `ciRunUrl` pointing at the green Actions run, and optional `pluginDigest` /
   `artifactSha256`.

Reusable workflow:
`ReBoticsAI/GodMode-Marketplace/.github/workflows/reusable-plugin-verify.yml`

Intake CI does **not** replace buyer Bridge install pins or runtime capability
grants in GodMode core. Those remain separate trust layers.

## Catalog entry fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable slug (kebab-case) |
| `kind` | yes | `bundle` or `plugin` |
| `installType` | yes | `clone` (portable bundle) or `plugin` (GitHub repo) |
| `title` | yes | Display name |
| `description` | yes | Short summary |
| `version` | yes | Semver |
| `author` | yes | Name or org |
| `tags` | no | String array |
| `bundlePath` | clone | Path to `bundle.json` relative to repo root |
| `pluginRepo` | plugin | Public `https://github.com/owner/repo` URL |
| `pluginRef` | plugin | Immutable tag or commit SHA (floating `main` rejected) |
| `pluginDigest` | no | Expected commit SHA after checkout (buyer pin check) |
| `ciRunUrl` | plugin (new) | Green Actions run URL for this `pluginRef` |
| `artifactSha256` | no | Aggregate SHA-256 of verified build artifacts |

## Install types

- **clone**: GodMode resolves and fetches `bundlePath`, then passes the
  version-1 portable bundle to its importer. Bundle children are imported in
  array order, so order dependencies explicitly.
- **plugin**: GodMode clones the pinned `pluginRef`, builds a missing Bridge
  entry, validates and loads `godmode.plugin.json`, persists the discovery
  path, and installs the plugin for the current tenant. The install path
  returns `restartRequired: false`. ObjectTypes register before Record seeds
  and the target plugin's `tenant:install` hook; plugin knowledge is
  synchronized afterward.

Manifest-only plugins may declare `objectTypes` and deterministic-id `records`
without `bridge.entry`. Executable Bridge/web plugins receive versioned kernel
clients through `api.kernel`; both currently report `apiVersion: 1`. Declare
`kernelApiVersion: 1` in `godmode.plugin.json`. A different declared version is
rejected during host manifest validation.

## Validation

Use Node 22 and run `npm ci`, `npm run validate`, and `npm test` before opening
a PR. The catalog validator checks local JSON schemas and cross-file identity,
version, bundle, Record-id, and retired-route invariants. For plugins it also
rejects floating `pluginRef` values and non-public `pluginRepo` URLs.

Set `MARKETPLACE_REQUIRE_PLUGIN_CI=1` to also require `ciRunUrl` on every plugin
entry (strict verify-proof mode). Default CI enables the pin gate; seller PRs
must still include `ciRunUrl` per the checklist above. Tests cover pack Record
shapes and the plugin submission gate helpers.

The marketplace checks do **not** fetch `pluginRepo` or execute a host import.
Plugin build and `godmode.plugin.json` checks run in the reusable verify
workflow on the seller repository. Test clone packs with a host importer that
supports `kind: "record"` children.

Live access to another user's instance is **Shared**, not Marketplace.
