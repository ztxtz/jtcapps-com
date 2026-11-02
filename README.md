# JTC website

Public site: https://jtcapps.com

Static files in this repository, published to the Cloudflare Pages project
`jtcapps-site` by `./deploy.sh`, which needs `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`. Pushing to `main` does not deploy. Roll back from the
project's Deployments list in the Cloudflare dashboard. There is no build step.

## Homepage

`index.html`, `home.css` and `home.js` are maintained here, and `/work/`, `/privacy/` and `404.html` share them. `home.js` runs the
WebGL Silk hero and leaves the CSS gradient in `home.css` in place without WebGL.
Fonts are self-hosted in `assets/fonts/` (latin subsets, licences in `licenses/`)
because the privacy notice names no font provider.

The homepage stays abstract, except for the link cards at the bottom of the hero, which
open each app's site in a new tab. Adding an app means adding a card, with a thumbnail
in `assets/`. `/work/` lists the apps too. The design source is the canvas
https://claude.ai/artifact/PM9oETjacwDBpEDqZ7jXST.

## Other pages

`/unfeast/` comes from `launch/jtc-homepage/public/` in
https://github.com/tom28881/Unfeast, branch `codex/jtc-website-analytics`. When
importing from there, copy only `unfeast/` and merge any `privacy/` text by hand: that bundle's
root files are the previous homepage and would overwrite this one. The legacy `/ios/` pages and root
`style.css` are kept for existing links.

Keep the `noindex` metadata and Coming soon status until launch. App availability and
mailbox handling are separate from website deployment.

## Production verification

Check HTTPS responses for `/`, `/work/`, `/privacy/`, `/unfeast/`, `/unfeast/support/`,
`/unfeast/privacy/`, `/unfeast/terms/` and `/unfeast/consumer-health/`. Confirm a
missing path returns HTTP 404 with `404.html`, HTTP redirects to HTTPS, and `www`
redirects to the apex domain. Compare live page and asset bytes with committed files.

The site includes a self-hosted Umami integration. Its privacy notice and tracking
assets must stay in place. Sensitive paths do not load analytics, and browser privacy
signals are respected.
