# Verified local results

The original **16 October 2026** build record below is retained as history. Independent QA subsequently found that its claimed clean-install typecheck/build result was not reproducible: eight TS2580 errors exposed the missing direct `@types/node` dependency. The repair verification recorded above the original environment section supersedes that clean-install claim. All work is local to the project checkout, with one builder and one Playwright worker; no remote repository, hosted CI, account, backend or cloud service was used.

## Narrow repair — clean-install verification

The repair adds pinned **`@types/node@22.19.0`** as an explicit devDependency and lists `node` and `vite/client` in TypeScript's `types` configuration. Vite and Vitest resolve the same local Node types. Playwright now defaults to bundled Chromium, with `MARGIN_BROWSER_CHANNEL` reserved for an explicit override. No app source, UI, runtime dependency or offline logic changed.

The prior `node_modules` tree was replaced by **`npm ci --ignore-scripts --no-audit --no-fund`** (exit 0, **158 packages installed**). A temporary marker inside the prior tree was absent afterward, confirming replacement rather than reuse. The attempted manual removal command was blocked by automatic review; npm's documented clean-install behavior completed the operation safely. No global npm package or system browser was installed.

Playwright 1.64.1's matching bundled Chromium/headless shell **156.0.8078.4**, revision **1248**, was downloaded under the project's ignored `.cache/playwright` directory. `PLAYWRIGHT_BROWSERS_PATH` pointed there and `MARGIN_BROWSER_CHANNEL` was **unset** for the canonical browser command. The default portable browser path was exercised, not the installed-Chrome override. Node 25.1.0, npm 11.6.2, Windows and the two original viewport/timezone projects were retained.

| Canonical command      | Actual repair result                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `npm test`             | Exit 0; **22 passed**, 0 failed; Vitest **435 ms**                                    |
| `npm run lint`         | Exit 0; no warnings allowed                                                           |
| `npm run typecheck`    | Exit 0; no TS2580 or other diagnostics                                                |
| `npm run build`        | Exit 0; 35 modules; Vite **1.12 s**; offline revision `c2d883956c2d`                  |
| `npm run format:check` | Exit 0; source, tests, tooling and Markdown checked                                   |
| `npm run test:e2e`     | Exit 0; **26 passed**, 0 failed, 0 skipped, 0 flaky; **32.3 s**; retries 0, workers 1 |

All canonical commands ran serially after the clean install. Browser results started at **2026-10-16T14:44:16.282Z**, with machine duration **32283.072 ms**: **13 desktop** cases at 1440×900 and **13 mobile** cases at 390×844. This includes keyboard dialogs, replacement cancel/accept/reload, data recovery, storage failures, local task/note editing and links, offline shell reload and absence of remote runtime requests. The existing coverage list below still describes those tests.

The production CSS and JavaScript filenames, sizes and offline cache revision match the original build, and git confirms no changes to `src/`, `public/`, `scripts/`, `index.html` or `LICENSE`. Browser tests regenerated their nine screenshots locally; the original committed screenshot evidence was retained to keep this repair free of browser-version image churn. The original screenshot descriptions below refer to that original capture run.

The optional [Supabase schema and policy examples](supabase-setup.md) were authored and reviewed as text only. They are **UNEXECUTED / NOT VERIFIED LIVE**, excluded from npm/CI execution, and not validated by these app checks. No backend or account was accessed. Hosted CI was not run. No audit command was rerun in this repair; the reported independent audit is not presented as a new result here. The existing ESLint deprecation and Playwright color-variable notices remain nonfatal.

## Original environment and gate record (historical)

- Windows, PowerShell; Node **25.1.0**, npm **11.6.2**.
- Installed Google Chrome **155.0.8059.84**, headless, fresh isolated test contexts without account profiles.
- Desktop viewport **1440×900**, timezone **America/Los_Angeles**.
- Mobile viewport **390×844**, touch/mobile emulation, timezone **Pacific/Auckland**.
- Local production preview at **http://127.0.0.1:4183**. The test runner started and stopped this server.

| Command                                        | Actual final result                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm ci --ignore-scripts --no-audit --no-fund` | Exit 0; 156 packages installed from lockfile                                               |
| `npm test`                                     | Exit 0; 1 file, **22 passed**, 0 failed; Vitest duration **457 ms**                        |
| `npm run lint`                                 | Exit 0; ESLint with `--max-warnings 0`                                                     |
| `npm run typecheck`                            | Exit 0; strict TypeScript, no emit                                                         |
| `npm run build`                                | Exit 0; 35 modules; Vite build **1.18 s**; generated offline cache revision `c2d883956c2d` |
| `npm run test:e2e`                             | Exit 0; **26 passed**, 0 failed, 0 skipped, 0 flaky; **37.7 s**, retries 0, workers 1      |
| `npm run format:check`                         | Exit 0; source, tests, tooling and documentation formatted                                 |

The final browser run started at **2026-10-16T14:24:47.042Z**. Its machine-readable duration was **37718.999 ms**. Production assets: CSS **17.65 kB** (**4.69 kB gzip**), JavaScript **224.68 kB** (**70.87 kB gzip**), index **0.65 kB**. Build output, installed packages, browser failure artifacts and test reports are ignored by git.

## Browser coverage

Each of these 13 cases passed in **both** viewport projects:

1. Visible notebook text contrast at least 4.5:1 in the exercised fixture, with reduced motion enabled.
2. Original layout; combined title/body/tag search; filters, matching counts, sorting, resets and no horizontal overflow.
3. Keyboard creation/editing, initial focus, reverse/forward Tab containment, Escape, focus restoration, note and task edits, tags, links, complete/reopen, due dates and reload.
4. Validated import: Cancel and Escape preserve the complete exported workspace and stored bytes; acceptance replaces all fields, tags and links and survives reload. Script-looking content stays inert.
5. Sample load and empty reset: both cancellation routes retain full data and storage across reloads; accepted replacements survive reload. Empty-state note creation works.
6. Malformed, oversized, duplicate-ID, dangling-link, unsupported-version, overlong-field, excessive-count and prototype-key imports never open a confirmation or mutate storage.
7. Task archive/restore and note delete confirmations; deleting a note atomically cleans task links and persists.
8. Unsupported/malformed stored data is protected; recovery export retains the original string; explicit validated import can recover it.
9. Denied storage and quota failure show honest status. Ordinary edits remain exportable in memory. Failed destructive writes leave the entire current notebook and persisted bytes unchanged.
10. Production shell reloads while the browser context is offline and retains saved task state.
11. Fresh sample status is explicit; first change persists; application requests stay on the local origin.
12. Stale edits cannot silently overwrite another tab’s newer stored value; the stale in-memory copy remains exportable.
13. Editing links/details then cancelling changes nothing; task delete confirmation traps focus and supports Cancel/Escape; accepted deletion survives reload without changing notes.

The 22 unit tests cover pure transitions, deterministic fixtures, full-fidelity serialization, cross-field search, filters/sorts/archive selection, strict validation boundaries, Gregorian date-only handling, prototype payload rejection, denied/quota storage, recovery protection, stale writes and a single-write replacement.

## Screenshots

All nine PNGs were captured from the real built app by the test suite. The workspace images use the default synthetic notebook. The mobile notes image is scrolled to the writing surface. Recovery images show an intentionally invalid stored version. Confirmation images show Cancel with visible keyboard focus.

| File                                                             | Actual pixel dimensions |
| ---------------------------------------------------------------- | ----------------------- |
| [Desktop workspace](screenshots/desktop-workspace.png)           | 1440×900                |
| [Desktop full workspace](screenshots/desktop-workspace-full.png) | 1440×1518               |
| [Mobile workspace](screenshots/mobile-workspace.png)             | 390×844                 |
| [Mobile full workspace](screenshots/mobile-workspace-full.png)   | 390×1814                |
| [Mobile note surface](screenshots/mobile-notes.png)              | 390×844                 |
| [Desktop confirmation](screenshots/desktop-confirmation.png)     | 1440×900                |
| [Mobile confirmation](screenshots/mobile-confirmation.png)       | 390×844                 |
| [Desktop recovery](screenshots/desktop-recovery.png)             | 1440×1149               |
| [Mobile recovery](screenshots/mobile-recovery.png)               | 390×1310                |

Desktop workspace, mobile workspace, mobile note surface and the mobile confirmation were visually inspected after the final changes. Earlier iterations exposed and fixed reverse-Tab escape, lingering menu overlays and low-contrast muted text. The initial Playwright bundled browser was unavailable; the existing Chrome was used instead. No browser was installed on this machine.

## Honest limits

There are **no unresolved implementation or verification blockers** for this local scope. Hosted CI, physical mobile devices, other browser engines and live assistive-technology sessions were not run. The contrast check covers the exercised fixture and is not a claim of a complete accessibility audit. npm emitted a deprecation notice for pinned ESLint 9.39.4; checks still passed. Playwright emitted environment color-variable warnings. No security-audit result is claimed.

The original build omitted the optional backend documents. The narrow repair adds the [design guide](supabase-setup.md), [schema](supabase-schema.sql) and [policy examples](supabase-policy-examples.sql), all **UNEXECUTED / NOT VERIFIED LIVE**. There is no schema deployment, Supabase verification, sync service or account integration. LocalStorage can still lose data if the browser clears it; exports are the backup. The README describes localStorage racing-write and offline update limitations.
