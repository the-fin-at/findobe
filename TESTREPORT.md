# FinDobe – F01–F06 validation (02.10.2026)

The reviewed working tree already contained prerequisites absent from main: the local Markdown editor, document tabs, native binary PDF/file handling, and preview/print support. They are included in a separate prerequisite commit. MSI packaging, default-app tooling and local installation history are excluded. Version 0.3.0 reflects that existing working baseline; this PR does not release or install an app.

| Finding | Delivered behavior |
| --- | --- |
| F01 | One Save/Save As shortcut route; reserve the save/export action before awaiting; cancel and errors preserve edits/history. |
| F02 | HTML text-list buttons support Enter/Space, selected state and restored focus after commit/cancel. |
| F03 | Named PDF text actions with a roving tab stop and arrows/Home/End; locked text explains its reason; status/error feedback. |
| F04 | Reversible PDF operator-byte history; undo restores original bytes and tracks the last saved baseline. |
| F05 | Refresh current local Markdown resources for preview/export; deduplicate loads and reject stale results; Save As updates the resource base. |
| F06 | Visible-page canvas caching under 64 MiB RGBA; hidden tabs release buffers; preserve page placeholders, text/history, focus, scroll and export; serial rendering and unchanged-fit optimization. |

## Successful final suite

- `npm test`: Rust 6/6 and Node 7/7. Real file roundtrip/conflict checks; not native dialog coverage.
- `npm run build:editor` and native macOS debug app builds succeeded.
- `npm run test:browser`: 8/8 Chromium smokes (editor, preview, markdown, usability, tabs, pdf, review-fixes, pdf-cache). Browser Tauri calls are mocked. The runner creates isolated sessions/server and detects CLI-reported errors even when exit status is zero.
- HTML BOM/CRLF/source preservation; Markdown syntax/EOL/history; PDF binary roundtrip and byte-exact undo; tabs, cancel/error paths, search, zoom and export payloads passed.
- Baseline F01 regression failed with `Save As routed twice from body`; final regression passed.
- No source behavior changed during PR packaging. Committed runtime/build/test sources match the successfully tested checkout byte for byte. Only the unrelated MSI npm script and local documentation history are omitted. Successful tests were reused rather than repeated.

## PDF canvas measurement

100-page A4 fixture, Chromium 1240 × 900, two tabs, DPR 1 and 2. Scroll to last page, zoom to 3.8, keyboard focus, edit page 50, eviction, undo/redo, save/reopen and offscreen search passed. An additional short-page probe displayed all simultaneously visible pages.

| DPR | Initial buffers | Initial RGBA bytes | Peak buffers | Peak RGBA bytes |
| --- | ---: | ---: | ---: | ---: |
| 1 | 2 | 15,654,912 | 4 | 67,077,696 (63.97 MiB) |
| 2 | 2 | 62,619,648 | 4 | 67,077,696 (63.97 MiB) |

Hidden tabs: zero active canvas buffers. All 100 page placeholders and 200 text actions remain present. High zoom/DPR may reduce raster resolution to meet the budget; source geometry and saved PDF bytes are retained. This bounds canvas RGBA, not total process RSS, PDF parser data or overlay DOM.

## Targeted native macOS Save As result

A separate temporary debug app with its own bundle identity and no file associations exercised the current F01 code; the installed user app was not used or replaced. A disposable HTML fixture was opened through the real native dialog, edited, then Cmd+Shift+S invoked the real Save As dialog. The original file remained unchanged while the dialog was open and after cancellation; the dirty edit/history survived. Native undo/redo worked. Normal Cmd+S wrote only the intended text replacement, preserving BOM, CRLF and all other bytes. The test app was then quit.

Original SHA-256 before/during/after cancel: `a14afa9c43983a6f22377a31e124b87a3dfbe17226aa3ddb0fa36c123532ac78`.

The native check preceded the final F06 short-page adjustment; F01 save/shortcut routing was unchanged afterward. Browser checks and Rust tests are separate evidence, not substitutes for this native dialog result. Native screenshots, final logs, before/after browser screenshots, baseline backups and the loop-only patch are retained locally in the thread evidence library.

## Remaining coverage and limitations

No required F01–F06 implementation remains unresolved. Unrun: Windows/WebView2 shortcut/dialog runtime, Windows installation/upgrade; real VoiceOver/Windows screenreader operation; full native PDF/Markdown/print/Finder/quit matrix; broad PDF/font corpus; total RSS/long-running memory behavior. Parser/DOM virtualization and splitting the global editor into adapters remain optional architecture work.

No merge, installation, app replacement, release or project-memory changes. The existing GitHub workflow is manual (`workflow_dispatch`); local validation does not imply hosted CI ran.
