# GodMode Marketplace

Official catalog of free GodMode packs and plugins. The GodMode app pulls `catalog/index.json` from this repo to populate the **Official** Marketplace tab.

## Submit a listing

1. Fork this repo.
2. Add your pack under `packs/<id>/` or plugin manifest under `plugins/<id>/`.
3. Add an entry to `catalog/index.json`.
4. Open a pull request using the checklist in [CONTRIBUTING.md](CONTRIBUTING.md).

Private plugins stay on your GitHub account and are added in GodMode under **Marketplace → Unofficial**.

## Layout

```
catalog/index.json       Official listing index
packs/<id>/              Portable bundles (clone install)
plugins/<id>/            Plugin catalog entries (repo pointers)
schemas/                 JSON Schema for CI validation
```

## Catalog URL

Default official URL (override with `MARKETPLACE_OFFICIAL_URL` in Bridge):

`https://raw.githubusercontent.com/ReBoticsAI/GodMode-Marketplace/main/catalog/index.json`

## Validate the catalog

Run `npm install`, then `npm run validate` and `npm test`. Validation checks the
catalog and portable-bundle schemas, manifest/version consistency, kernel Record
shapes, and retired mutation route strings.
