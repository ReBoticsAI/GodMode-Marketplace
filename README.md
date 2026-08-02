# GodMode Marketplace

Official catalog of free GodMode packs and plugins. The GodMode app pulls `catalog/index.json` from this repo to populate the **Official** Marketplace tab.

## Submit a listing

1. Fork this repo.
2. Add your pack under `packs/<id>/` or plugin manifest under `plugins/<id>/`.
3. For **plugins**: run the [seller intake verify workflow](examples/seller-plugin-verify.yml) on a public GitHub repo, then pin `pluginRef` to that tag/commit and link `ciRunUrl`.
4. Add an entry to `catalog/index.json`.
5. Open a pull request using the checklist in [CONTRIBUTING.md](CONTRIBUTING.md).

Private plugins stay on your GitHub account and are added in GodMode under **Marketplace → Unofficial**.

## Trust layers

| Layer | Where | Role |
|-------|-------|------|
| **Intake verify** (this repo) | GitHub Actions reusable workflow | Build + manifest checks before listing |
| **Buyer install pin** | GodMode Bridge | Install only the catalog `pluginRef` / digest |
| **Runtime capabilities** | GodMode Bridge | Network / tools / records deny-by-default |

Intake CI does not replace Bridge runtime least privilege.

## Layout

```
catalog/index.json       Official listing index
packs/<id>/              Catalog manifest + portable Record bundle
plugins/<id>/            Catalog manifest (source-repository pointer)
schemas/                 JSON Schema for CI validation
examples/                Seller workflow caller template
.github/workflows/       Catalog CI + reusable plugin verify
```

Pack `manifest.json` files mirror catalog identity and version metadata. Their
`bundle.json` install payload is a version-1 `kind: "bundle"` envelope whose
`data.children` are version-1 `kind: "record"` envelopes. Each child contains
only `data.record`, with:

- a stable `id`;
- an `objectType` currently accepted by this catalog (`StructureNode`, `Agent`,
  or `Skill`); and
- Record `data` whose `id` matches both the Record id and child `sourceId`.

Keep dependency-sensitive children in import order (for example, a parent
`StructureNode` before its descendants). Clone installation fetches the
catalog entry's `bundlePath` and submits that portable bundle to GodMode's
importer, which processes bundle children in order. These migrated packs
therefore require a coordinated host whose portability importer supports
`kind: "record"` children.

Plugin `manifest.json` files in this repository are also catalog mirrors; they
are not the executable plugin manifest. The referenced plugin repository must
contain a valid `godmode.plugin.json`. Bridge/web plugin code should declare
`kernelApiVersion: 1` there and use the versioned `api.kernel` client
(`api.kernel.apiVersion === 1`). The host rejects a declared unsupported future
kernel API version instead of guessing compatibility. Keep the catalog entry,
this repository's manifest, and the source plugin version coordinated.
`pluginRef` must be a tag or commit SHA (floating `main` is rejected by
validate).

## Catalog URL

Default official URL (override with `MARKETPLACE_OFFICIAL_URL` in Bridge):

`https://raw.githubusercontent.com/ReBoticsAI/GodMode-Marketplace/main/catalog/index.json`

## Validate the catalog

Use Node 22 (the CI version), then run:

```
npm ci
npm run validate
npm test
```

`npm run validate` checks the catalog and portable-bundle schemas, unique
catalog ids, catalog/local-manifest id-kind-version agreement, plugin pin
gates (public repo + immutable `pluginRef`), bundle `sourceId`, Record/child
id agreement, and retired mutation route strings. Set
`MARKETPLACE_REQUIRE_PLUGIN_CI=1` to also require `ciRunUrl` on plugin entries.
The tests assert the published pack versions, Record value shapes, and plugin
submission gate helpers.

Catalog validate does not clone `pluginRepo`. Seller intake builds and checks
`godmode.plugin.json` in the reusable workflow on the plugin repository.
