# JTC Apps website

Public site: https://jtcapps.com

GitHub Pages serves the root of `main` in
https://github.com/ztxtz/jtcapps-com. Pushes to `main` deploy the site.
`CNAME` binds the custom domain; `.nojekyll` preserves the static bundle.

## Homepage source and updates

The homepage and `/unfeast/` subtree come from `launch/jtc-homepage/public/`
in https://github.com/tom28881/Unfeast, branch
`codex/jtc-website-analytics`.
Imported source revision: `58ddfeb`.

To update, check out the intended source revision, read its deployment
instructions, run `python3 verify.py` from `launch/jtc-homepage/`, then copy
the contents of `public/` to this repository root. Preserve `CNAME`,
`.nojekyll`, and the existing legacy `/ios/` pages. Compare copied files
byte for byte before committing and pushing to `main`.

No build step or external runtime is required. Keep the supplied licenses,
prelaunch `noindex` metadata, and Coming soon status. App availability and
mailbox handling are separate from website deployment.

## Production verification

Check the GitHub Pages build and HTTPS responses for `/`, `/privacy/`,
`/unfeast/`, `/unfeast/support/`, `/unfeast/privacy/`, `/unfeast/terms/`, and
`/unfeast/consumer-health/`. Confirm a missing path returns HTTP 404 with
the supplied `404.html`, HTTP redirects to HTTPS, and `www` redirects to
the apex domain. Compare live page and asset bytes with committed files.

The homepage includes a self-hosted Umami integration. Its privacy notice and tracking assets are part of the upstream source; preserve them when updating the site. Sensitive paths do not load analytics, and browser privacy signals are respected.
