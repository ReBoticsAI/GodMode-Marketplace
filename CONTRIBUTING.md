# Contributing to GodMode Marketplace

## PR checklist

- [ ] Entry added to `catalog/index.json` with unique `id`
- [ ] `manifest.json` in pack/plugin folder matches schema
- [ ] `bundle.json` validates as a GodMode portable bundle (version 1)
- [ ] No secrets, API keys, or operator-specific content
- [ ] Title and description are clear for OSS users
- [ ] Tags help browse/filter (e.g. `work`, `agents`, `skills`)

## Catalog entry fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable slug (kebab-case) |
| `kind` | yes | `bundle`, `skill`, `rule`, `agent`, `department`, `plugin`, etc. |
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

- **clone**: GodMode downloads `bundle.json` and imports via portability API.
- **plugin**: GodMode clones the plugin repo (or uses release tarball), adds to `GODMODE_PLUGIN_PATH`, and runs tenant install. Bridge restart may be required.

Live access to another user's instance is **Shared**, not Marketplace.
