# GodMode Marketplace

Dual catalog for GodMode:

| Catalog | Path | Marketplace tab |
|---------|------|-----------------|
| **Official** | `catalog/official/index.json` | Official (ReBotics-curated only) |
| **Community** | `catalog/community/index.json` | Community (user sellers) |

Legacy `catalog/index.json` mirrors Official for older GodMode `MARKETPLACE_OFFICIAL_URL` defaults.
Legacy `catalog/unofficial/index.json` mirrors Community for older GodMode `MARKETPLACE_UNOFFICIAL_URL` defaults.

## Submit a Community listing (user sellers)

1. Fork this repo.
2. Build your plugin in a **public** GitHub repo with `godmode.plugin.json`.
3. Run the [seller intake verify workflow](examples/seller-plugin-verify.yml), then pin `pluginRef` to that tag/commit and link `ciRunUrl`.
4. Add an entry to **`catalog/community/index.json`** (not Official).
5. Open a pull request using the checklist in [CONTRIBUTING.md](CONTRIBUTING.md).

Do **not** submit third-party plugins to Official. Official is maintained by ReBotics.

In GodMode Cloud you can also use **Marketplace → Sell** for portable listings. Plugin CI + pins still apply when installing Community plugins.

Private / operator catalogs stay under **Marketplace → Local** in the app.

## Trust layers

| Layer | Where | Role |
|-------|-------|------|
| **Intake verify** (this repo) | GitHub Actions reusable workflow | Build + manifest checks before Community listing |
| **Buyer install pin** | GodMode Bridge | Install only the catalog `pluginRef` / digest |
| **Runtime capabilities** | GodMode Bridge | Network / tools / records deny-by-default |

## Layout

```
catalog/official/index.json    ReBotics Official shelf
catalog/community/index.json   Community (user seller) shelf
catalog/index.json             Legacy Official alias (keep in sync)
catalog/unofficial/index.json  Legacy Community alias (keep in sync)
packs/<id>/                    Official pack manifests + bundles
plugins/<id>/                  Official plugin catalog mirrors
schemas/                       JSON Schema for CI validation
examples/                      Seller workflow caller template
.github/workflows/             Catalog CI + reusable plugin verify
```

## Validate locally

```bash
npm test
npm run validate
```
