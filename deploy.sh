#!/bin/zsh
# Publishes this site to Cloudflare Pages project jtcapps-site (jtcapps.com).
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.
set -euo pipefail
cd "$(dirname "$0")"
out=$(mktemp -d); trap 'rm -rf "$out"' EXIT
rsync -a --exclude .git --exclude .nojekyll --exclude CNAME --exclude README.md --exclude SELF_NOTES.md --exclude deploy.sh ./ "$out/"
npx --yes wrangler@4 pages deploy "$out" --project-name jtcapps-site --branch main --commit-hash "$(git rev-parse --short=12 HEAD)" --commit-dirty=true
