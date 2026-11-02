# Project memory

- Hosting repository: https://github.com/ztxtz/jtcapps-com. Cloudflare Pages project `jtcapps-site` serves the site, published by `./deploy.sh`; pushing to `main` does not deploy. DNS is on Cloudflare. A machine with a stale resolver can still see the old GitHub Pages address and a "Site not found" 404, so verify with `dig @1.1.1.1` before treating that as an outage.
- Homepage rule from the owner: abstract, with copy about craft rather than apps. The only app material on `/` is the link cards at the bottom-left of the hero, each opening an app's site in a new tab with a homepage thumbnail. No app icons. Refresh a thumbnail when that site's look changes. Contact is info@jtcapps.com, a real mailbox.
- `README.md` has the file layout and verification list. The Unfeast repo's bundle still contains the previous homepage, so importing all of it would overwrite this one.
