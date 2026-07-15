# Contributing to GodMode Marketplace

## PR checklist

- [ ] Entry added to `catalog/index.json` with unique `id`
- [ ] Local `manifest.json` id, kind, and version match the catalog entry
- [ ] Clone entry has a version-1 `kind: "bundle"` `bundle.json` at `bundlePath`
- [ ] Every bundle child is a version-1 `kind: "record"` envelope whose only data member is `record`
- [ ] Every Record has `id`, `objectType`, and `data`; Record `data.id`, Record `id`, and child `sourceId` match
- [ ] Records use current kernel value shapes, not legacy table/envelope shapes or retired mutation routes
- [ ] Parent/dependency Records precede children that reference them
- [ ] Plugin source contains a valid `godmode.plugin.json`; executable Bridge/web plugins declare `kernelApiVersion: 1` and use `api.kernel`
- [ ] Plugin catalog, local manifest, and source `godmode.plugin.json` versions are coordinated
- [ ] No secrets, API keys, or operator-specific content
- [ ] Title and description are clear for OSS users
- [ ] Tags help browse/filter (e.g. `work`, `agents`, `skills`)

The `manifest.json` beside a pack or plugin in this repository is catalog
metadata, not the plugin runtime manifest. Runtime fields such as
`kernelApiVersion`, `bridge`, `web`, `objectTypes`, and `records` belong in the
referenced source repository's `godmode.plugin.json`.

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
| `pluginRepo` | plugin | GitHub repo URL |
| `pluginRef` | plugin | Branch, tag, or commit (default `main`) |

## Install types

- **clone**: GodMode resolves and fetches `bundlePath`, then passes the
  version-1 portable bundle to its importer. Bundle children are imported in
  array order, so order dependencies explicitly.
- **plugin**: GodMode clones the requested `pluginRef` (or updates an existing
  checkout), builds a missing Bridge entry, validates and loads
  `godmode.plugin.json`, persists the discovery path, and installs the plugin
  for the current tenant. The install path returns `restartRequired: false`.
  ObjectTypes register before Record seeds and the target plugin's
  `tenant:install` hook; plugin knowledge is synchronized afterward.

Manifest-only plugins may declare `objectTypes` and deterministic-id `records`
without `bridge.entry`. Executable Bridge/web plugins receive versioned kernel
clients through `api.kernel`; both currently report `apiVersion: 1`. Declare
`kernelApiVersion: 1` in `godmode.plugin.json`. A different declared version is
rejected during host manifest validation.

## Validation

Use Node 22 and run `npm ci`, `npm run validate`, and `npm test` before opening
a PR. The catalog validator checks local JSON schemas and cross-file identity,
version, bundle, Record-id, and retired-route invariants. Tests cover the exact
published pack set and current Record value shapes.

The marketplace checks do **not** fetch `pluginRepo`, validate its
`godmode.plugin.json`, execute a clone bundle import, or run a plugin's
build/install lifecycle. Test clone packs with a host importer that supports
`kind: "record"` children. For plugin entries, also test the source repository
against the coordinated GodMode host version, including manifest validation,
ObjectType/Record registration, tenant install, uninstall/reinstall, and tenant
isolation.

Live access to another user's instance is **Shared**, not Marketplace.
