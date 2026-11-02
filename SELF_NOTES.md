# Project memory

- Hosting repository: https://github.com/ztxtz/jtcapps-com. Cloudflare Pages project `jtcapps-site` serves the site, published by `./deploy.sh`; pushing to `main` does not deploy. DNS is on Cloudflare. A machine with a stale resolver can still see the old GitHub Pages address and a "Site not found" 404, so verify with `dig @1.1.1.1` before treating that as an outage.
- Homepage rule from the owner: abstract only. No app names, icons, screenshots or counts on `/`, and copy about craft rather than apps. App names go on `/work/`. Contact is info@jtcapps.com, a real mailbox.
- `README.md` has the file layout and verification list. The Unfeast repo's bundle still contains the previous homepage, so importing all of it would overwrite this one.
- `privacy/` and `404.html` still use the previous light design through `jtc.css`.
