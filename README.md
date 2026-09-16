# FinDobe

Ein kleines Desktop-Werkzeug im THE-FIN-Design. HTML und Markdown als Dokument lesen, Texte direkt in der Ansicht bearbeiten, speichern und als PDF ausgeben. Kein Browser-Tab und kein lokaler Server erforderlich.

## Benutzen

1. **Datei öffnen…** wählen oder eine Datei ins Fenster ziehen.
2. Text anklicken und bearbeiten. **Enter** übernimmt die Änderung, **Esc** verwirft die aktuelle Eingabe. In Markdown fügt **Shift+Enter** eine Zeile darunter ein.
3. **Speichern** schreibt in die geöffnete Datei. **Speichern unter…** erstellt eine separate Datei im gleichen Format.
4. **Als PDF exportieren** öffnet die Druckvorschau des Betriebssystems. Am Mac unten **PDF → Als PDF sichern** wählen; unter Windows **Microsoft Print to PDF** als Drucker wählen.

Tastenkürzel: ⌘/Strg+O öffnen, ⌘/Strg+S speichern, ⌘/Strg+Shift+S speichern unter, ⌘/Strg+P PDF. Ungespeicherte Änderungen werden beim Öffnen einer anderen Datei und beim Beenden abgefragt.

## Plattformen / Stand 0.1

- **macOS:** lokal gebaute und getestete Apple-Silicon-App; installiert unter `/Applications/FinDobe.app`. Mindestversion laut Build-Konfiguration macOS 12. Nicht mit Apple Developer ID signiert oder notarisiert; die Weitergabe auf andere Macs ist noch kein fertiger öffentlicher Release.
- **Windows:** x64-Programm erfolgreich cross-kompiliert. Das ZIP vollständig entpacken und `FinDobe.exe` starten; `WebView2Loader.dll` muss daneben bleiben. Microsoft Edge WebView2 Runtime wird benötigt. **Noch kein Laufzeittest unter Windows.** Die GitHub-Actions-Vorlage kann zusätzlich einen NSIS-Installer unter Windows bauen; sie wurde nicht ausgeführt.
- Ein Intel-Mac-Paket ist in dieser Lieferung nicht enthalten.

## Umfang und Grenzen

Version 0.1 ist ein visueller **Textkorrektur-Editor**, kein vollständiger Word-Ersatz und kein freier HTML-Seiten-Designer. Bestehende HTML-Gestaltung und Markdown-Syntax werden beim Bearbeiten möglichst quelltreu erhalten. Markdown-Listen und Tabellenzellen sind bearbeitbar. Komplexe interaktive Webseiten, eingebettete Apps, JavaScript-generierte Inhalte und beliebige Layout-Umbauten gehören nicht zum unterstützten Umfang.

- Unterstützt `.html`, `.htm`, `.md`, `.markdown`, `.txt`; UTF-8, maximal 30 MB je Datei. `.txt` wird als Markdown dargestellt.
- Dokumente werden lokal verarbeitet; keine Cloud, keine Anmeldung, keine KI-API.
- Dokument-Skripte werden in der Ansicht nicht ausgeführt. Internet-Ressourcen werden nicht nachgeladen. Eingebettete Bilder/Schriften und unterstützte relative Ressourcen im Dokumentordner funktionieren; Ressourcen außerhalb dieses Ordners und CSS-`@import` werden nicht nachgeladen. Das kann das Aussehen fremder HTML-Dateien verändern.
- Änderungen an der Datei durch andere Programme werden vor dem normalen Speichern erkannt und nicht still überschrieben. Das ersetzt keine Backups und ist kein vollständiger Schutz gegen zeitgleiche Schreibvorgänge.
- PDF verwendet das Drucklayout des Dokuments und den Systemdialog. Seitenumbrüche hängen vom Dokument ab.

## Entwicklung

Rust / Tauri 2 übernimmt Fenster, Dateizugriff, Systemdialoge, Schreibschutz und PDF-Druck. Die eingebettete WebView stellt Dokumente dar; der visuelle Editor ist JavaScript. Damit ist FinDobe eine installierbare Desktop-App, aber ausdrücklich keine vollständig in Rust geschriebene Rendering-Engine.

```sh
npm ci
npm run dev
npm test
# Auf macOS:
npx tauri build --bundles app,dmg
# Auf Windows mit Rust/MSVC und WebView2:
npx tauri build --bundles nsis
```

Voraussetzungen und Plattform-Toolchains: [Tauri-Dokumentation](https://v2.tauri.app/start/prerequisites/).

`tests/demo.html` und `tests/demo.md` sind synthetische Beispieldateien. `tests/editor-smoke.js` ist ein Playwright-CLI-Test mit simulierten Systemdialogen; Browser-Bearbeitung und native Dateioperationen werden getrennt geprüft. Für einen Test eine frische Browser-Session und einen lokalen Server für `ui/` auf Port 17893 verwenden. `TESTREPORT.md` dokumentiert die tatsächlich ausgeführten Prüfungen.

Die Bearbeitungslogik stammt aus der vom Nutzer bereitgestellten VoxDobe-Datei. THE-FIN-Logo und Schriften stammen aus den bereitgestellten Markenunterlagen. DOMPurify-Lizenz liegt in `ui/assets/DOMPurify-LICENSE`; weitere gebündelte Bibliotheken behalten ihre Lizenzhinweise.
