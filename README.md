# Findobe

**Free, local document editing. Built for humans and agents.**

Findobe is an open-source desktop editor by [THE-FIN](https://the-fin.at/). Write and review documents, work alongside your own AI agent, and export your work to everyday formats. Your documents stay on your computer. No account, subscription, or built-in model API key is required.

[Website](https://the-fin-at.github.io/findobe/) · [User guide (Deutsch)](docs/USER-GUIDE.de.md) · [Agent & document contract](docs/DOCUMENT-CONTRACT.md) · [Report an issue](https://github.com/the-fin-at/findobe/issues)

## What you can do

- **Write visually:** headings, lists, tables, images, page layout, comments, and reviewable suggestions.
- **Work with agents:** a local authenticated bridge lets your own agent read and edit the same document, with revision checks and shared undo/redo.
- **Keep an open working file:** `.findobe` stores your document, stable block IDs, comments, suggestions, and history in self-contained JSON.
- **Import and export:** DOCX, ODT, HTML, Markdown, plain text, and PDF. Preview exported PDFs in a separate tab.
- **Keep the original editors:** edit HTML text, write Markdown with source and preview views, or correct supported text in existing PDFs.
- **Stay local:** document processing and draft recovery happen on your computer. Findobe does not include cloud sync or an AI service.

The desktop interface is currently in German. You can edit documents in other languages.

## Get started

The source is at **0.4.0**. There is currently no public downloadable desktop release. Build from source using the instructions below; future packages will appear under [GitHub Releases](https://github.com/the-fin-at/findobe/releases).

| Platform | Current status |
| --- | --- |
| macOS | Developed and tested locally on Apple Silicon. Minimum macOS 12. Public signing and notarization are pending. |
| Windows | Build configuration and earlier x64 pilot packaging are included. Current 0.4.0 runtime and installation have not been tested on Windows. WebView2 is required. |
| Linux | No verified build or runtime support yet. |

### Build from source

Install Node.js 22 or newer, npm, Rust, and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/). Clone the repository, then:

```sh
git clone https://github.com/the-fin-at/findobe.git
cd findobe
npm ci
npm run build:editor
npm run dev
```

Build a desktop bundle on its target platform:

```sh
# macOS
npx tauri build --bundles app,dmg

# Windows, with the Rust/MSVC toolchain and WebView2
npx tauri build --bundles nsis
```

See [Windows deployment notes](packaging/windows/DEPLOYMENT.md) for the earlier MSI pilot. Those package notes are historical and do not establish a tested 0.4.0 release.

### Work with your agent

Start Findobe and open a shared document. **Agentenzugang** shows the connection for the running app. With Node.js available:

```sh
node scripts/findobe-agent.mjs describe
node scripts/findobe-agent.mjs list
node scripts/findobe-agent.mjs read DOCUMENT_ID
```

The bridge binds only to `127.0.0.1` and requires a session token. Keep its connection manifest private. Agent edits are real document changes; review suggestions and keep backups. Read the [full contract](docs/DOCUMENT-CONTRACT.md) for operations, revision checks, and format limits. Try the [sample working document](examples/mensch-und-agent.findobe).

## Know the limits

Office imports preserve supported content, not every Word or LibreOffice layout feature. PDF import uses the text layer; it does not reconstruct the original layout or perform OCR. PDF text correction supports only compatible fonts and encodings and is **not secure redaction**. Comments, proposals, and history survive fully only in `.findobe` files. There is no collaboration or synchronization between computers.

## Development and checks

Rust and Tauri 2 handle windows and local files. The embedded WebView uses JavaScript, CodeMirror, and Tiptap/ProseMirror for editing.

```sh
npm test
# Requires Python 3, playwright-cli, and its installed Chromium browser:
npm run test:browser
```

The browser checks simulate the desktop boundary. Native tests are separate and require a built app; see [the document contract](docs/DOCUMENT-CONTRACT.md#prüfen). [TESTREPORT.md](TESTREPORT.md) records historical checks and their limits.

## Website / GitHub Pages

The public landing page lives in [`site/`](site/). It uses plain HTML and CSS, self-hosted fonts, and relative asset paths so it works under GitHub Pages' `/findobe/` project path. It has no build dependencies, analytics, cookies, or third-party scripts. It presents the desktop app; it is not the desktop editor running in a browser.

Preview it locally with `python3 -m http.server 8080 --directory site`. The [Pages workflow](.github/workflows/pages.yml) publishes only `site/` on pushes to `main`. Configure the repository's Pages source as **GitHub Actions**.

## Contribute

Bug reports, documentation improvements, and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before reporting security-sensitive issues. Please use synthetic documents in public reports.

## License and credits

Findobe's original code is licensed under [MIT](LICENSE). Bundled libraries and fonts retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). THE-FIN and Findobe names and logos identify this project; the software license grants no trademark rights or endorsement.

## Made by THE-FIN

**The Future is Now.** Findobe is our free contribution to more useful everyday work with documents and AI. If it helps you, star the repository or share it.

Explore [THE-FIN](https://the-fin.at/) for AI workshops, practical training, and help bringing AI into your team's work.
