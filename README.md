# Privacy Policy Hub

This project is a pure static privacy-policy website for GitHub Pages.

## Folder structure

- `index.html`
- `assets/css/styles.css`
- `assets/js/app.js`
- `assets/images/logo.jpg`
- `assets/images/logo_header.jpg`
- `assets/images/apps/`
- `data/policies.js`
- `data/policies.json`
- `policies/*.md`
- `policies/_policy-template.md`
- `scripts/build_policies_data.py`

## How to add a new privacy policy

1. Duplicate `policies/_policy-template.md`
2. Rename it to the new policy filename inside `policies/`
3. Fill in the front matter and the actual policy text
4. Optional: add the app logo inside `assets/images/apps/` using the policy id as the filename, for example `slither-saga.png`
5. Optional: add or override fields in `data/policies.json` if you want manual control over things like order, category, excerpt, or logo path
6. Run `python scripts/build_policies_data.py`
7. Push the updated files to GitHub Pages

## Metadata options

The build script can read these fields from the markdown front matter:

- `id`
- `name`
- `shortName`
- `status`
- `effectiveDate`
- `platform`
- `category`
- `logo`
- `excerpt`
- `order`

## Important

The website reads from `data/policies.js`, which is generated automatically from the markdown files in `policies/`.

The `data/policies.json` file is now best treated as an optional override file, not the primary source of truth. If a markdown policy file exists but has no matching override entry, the build script will still detect it and include it in the site.
