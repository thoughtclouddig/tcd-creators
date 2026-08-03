---
name: Replit env quirks (this project)
description: Non-obvious platform behaviors that repeatedly caused failures in this repl
---

- `.replit` sets `NODE_ENV=production` globally, so plain `npm install` skips devDependencies. **How to apply:** always use `npm install --include=dev`, and keep anything needed at runtime (e.g. `tsx`) in `dependencies`, not devDependencies.
- Editing `.replit` requires writing a temp file and calling `verifyAndReplaceDotReplit`; doing so **wipes configured workflows** — reconfigure them afterwards.
- The deployer requires a `package.json` at the workspace root even though the app lives in `bd-platform/`. Root package.json uses `postinstall: npm install --prefix bd-platform`.
- `npx tsx` prompts interactively in workflows — use `./node_modules/.bin/tsx` instead.
- **Watch out:** package.json edits via node scripts have silently dropped deps before (tsx vanished once). After editing, verify the dep is still listed and installed.
