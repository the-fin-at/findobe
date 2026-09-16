# FinDobe 0.1 – Prüfstand 16.09.2026

## Erfolgreich geprüft

- Rust: 3/3 Tests bestanden (UTF-8/BOM/CRLF, Schutz vor externen Änderungen, ungültige Eingaben).
- Playwright/Chromium in frischer Session mit simuliertem Rust-Aufruf: HTML-Textkorrektur mit unverändertem übrigen Quelltext einschließlich CRLF und nicht ausgeführtem Script; exakter Markdown-Roundtrip mit Tabelle; bereinigter PDF-Inhalt; Abbrechen bei ungespeicherten Änderungen; fehlgeschlagenes Speichern behält Änderungen. Keine JavaScript-Laufzeitfehler im Test.
- Native Mac-App: Dialog zum Öffnen; HTML-Text direkt anklicken, ändern, mit Enter bestätigen, speichern; gespeicherte Testdatei kontrolliert.
- Native Mac-App: Markdown-Überschrift direkt bearbeiten und speichern; gespeicherte `.md` kontrolliert.
- Native Mac-PDF-Export: Systemdialog, PDF sichern, tatsächliche Datei mit einer A4-Seite erzeugt. Mit `pdfinfo` geprüft und als PNG gerendert; Überschriften, Tabelle, Liste und SVG-Text visuell kontrolliert. Belege in `test-results/native-export.pdf` und `.png`.
- Native Mac-App mit ⌘Q beendet; neu gebaute Release-App nach `/Applications/FinDobe.app` kopiert und gestartet. Oberfläche visuell geprüft. Installierte Binärdatei stimmt per SHA-256 mit dem Release-Build überein.
- Windows x64: Release-Build erfolgreich; EXE-Format und DLL-Abhängigkeiten geprüft. Portable ZIP enthält EXE und WebView2Loader.dll.
- `npm audit`: 0 gemeldete Schwachstellen. Kein vollständiges Sicherheits-Audit.

## Nicht geprüft / nicht geliefert

- Kein Windows-Laufzeittest und kein Test des Windows-Druckdialogs. Windows-Paket ist vorläufig.
- Keine Apple-Developer-Signierung/Notarisierung; kein signierter Windows-Installer. Keine Tests auf Intel-Mac oder älteren macOS-Versionen.
- Keine generelle Layoutgarantie für beliebige HTML-Dateien und keine Vollprüfung aller Funktionen der übernommenen Editor-Engine.
- Nicht als vollständiger Word-/Layout-Editor vorgesehen.

## Ausgaben

- `/Applications/FinDobe.app`
- `dist/FinDobe-macOS-AppleSilicon.zip`
- `dist/FinDobe-Windows-x64.zip`

Mac-Binärdatei SHA-256: `b8da98702ea2e9aceca18e3d9844dd7e79543482fd0428db01354ee62aba9635`
