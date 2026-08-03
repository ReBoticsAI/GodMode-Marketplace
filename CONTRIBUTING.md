# Contributing to GodMode Marketplace

## Two catalogs (one seller path)

| Catalog | Path | Who lists here |
|---------|------|----------------|
| **Official** | `catalog/official/index.json` | ReBotics / GodMode only (curated platform shelf) |
| **Community** | `catalog/community/index.json` | **User sellers** (the only public seller path) |

`catalog/index.json` is a **legacy alias** of Official for older GodMode installs. Do not add Community entries there.

Public sellers submit to **Community**. Do not open PRs that add third-party plugins to Official.

## PR checklist (Community sellers)

- [ ] Entry added to `catalog/community/index.json` with unique `id`
- [ ] Plugin source is a **public** GitHub repo with a valid `godmode.plugin.json`
- [ ] Plugin `pluginRef` is an **immutable tag or commit SHA** (not `main` / `master` / `HEAD`)
- [ ] Plugin entry links a **green** reusable verify run via `ciRunUrl` for that same ref
- [ ] Optional: `pluginDigest` (full commit SHA) and `artifactSha256` from verify outputs
- [ ] No secrets, API keys, or operator-specific content
- [ ] Title and description are clear for OSS users
- [ ] Tags help browse/filter

## PR checklist (Official / ReBotics only)

- [ ] Entry added to `catalog/official/index.json` (and mirrored in legacy `catalog/index.json`)
- [ ] Local `manifest.json` id, kind, and version match the catalog entry
- [ ] Clone entry has a version-1 `kind: "bundle"` `bundle.json` at `bundlePath`
- [ ] Plugin pin + optional `ciRunUrl` / digest as for Community plugins
- [ ] Author is ReBotics / GodMode

## Seller intake (plugin verify)

**Community** (and Official) **plugin** listings must pass verification-time isolation
on GitHub Actions before merge:

1. Add the reusable workflow caller to the plugin repo (copy
   [`examples/seller-plugin-verify.yml`](examples/seller-plugin-verify.yml) to
   `.github/workflows/plugin-verify.yml`).
2. Pin `uses:` to a Marketplace commit/tag and set `godmode_ref` to the GodMode
   core release you tested against.
3. Cut a release tag (or push the commit you will list) and confirm the verify
   job is green.
4. Open a Marketplace PR against **`catalog/community/index.json`** with
   `pluginRef` set to that tag or commit SHA, `ciRunUrl` pointing at the green
   Actions run, and optional `pluginDigest` / `artifactSha256`.

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
  version-1 portable bundle to its importer.
- **plugin**: GodMode clones the pinned `pluginRef`, builds a missing Bridge
  entry, validates and loads `godmode.plugin.json`, and installs for the tenant.

## In-app Community Sell

GodMode Cloud also supports **Marketplace → Sell** for portable entity listings
(user-to-user). Catalog PRs to `catalog/community/` are the gated path for
**plugins** that need CI + pins. Keep both aligned with the one Community seller
story; Official stays ReBotics-only.
