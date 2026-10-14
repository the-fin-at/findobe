# Third-party notices

The root MIT license applies to Findobe's original code. It does not replace the licenses of bundled dependencies or fonts. Retain the following notices when redistributing the app or site.

| Component | License / full notice |
| --- | --- |
| CodeMirror and its bundled dependencies | [Markdown editor notices](ui/assets/Markdown-editor-LICENSES.txt) |
| Tiptap / ProseMirror, DOCX, Mammoth, JSZip, pdfmake, Marked, Turndown, and bundled dependencies | [Document editor notices](ui/assets/Document-editor-LICENSES.txt) |
| DOMPurify | Apache-2.0 or MPL-2.0; [included Apache notice](ui/assets/DOMPurify-LICENSE) |
| PDF.js 3.11.174 (including the worker) | [Apache-2.0](ui/assets/PDFjs-LICENSE.txt); copyright Mozilla Foundation. The display bundle contains a documented native background-render scheduling adaptation. |
| pdf-lib 1.17.1 | [MIT](ui/assets/pdf-lib-LICENSE.txt); retains its bundled upstream notices. |
| Geist and Geist Mono | [SIL Open Font License 1.1](ui/assets/Geist-OFL.txt) |
| Instrument Serif (embedded legacy font asset) | [SIL Open Font License 1.1](ui/assets/Instrument-Serif-OFL.txt) |
| Albert Sans (document export and website) | [SIL Open Font License 1.1](ui/assets/document-fonts/OFL-Albert-Sans.txt); [website copy](site/assets/OFL-Albert-Sans.txt) |

`npm run build:editor` refreshes the two editor notices from the actual bundled package inputs. Rust dependencies remain under their respective licenses recorded in their package metadata; `src-tauri/Cargo.lock` pins their versions. JavaScript versions are pinned in `package-lock.json`.

THE-FIN brand assets are supplied by THE-FIN. The software license does not grant trademark rights, claim affiliation, or permit representing a fork as an official THE-FIN product.
