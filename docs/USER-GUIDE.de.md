# FinDobe

Ein lokales Desktop-Werkzeug im THE-FIN-Design. Dokumente visuell und gemeinsam mit Agenten bearbeiten, als Arbeitsdatei speichern und als PDF oder Office-Datei ausgeben. HTML, Markdown und PDF behalten zusätzlich ihre bisherigen Editoren. Kein Browser-Tab und kein lokaler Server erforderlich.

## Gemeinsame Dokumente ab 0.4.0

**Neues Dokument** öffnet einen durchgehenden visuellen Editor für Mensch und Agent. DOCX, ODT und `.findobe` öffnen direkt darin. Bei HTML, Markdown, Text und PDF erstellt **Gemeinsam bearbeiten** eine Arbeitskopie. Speichern sichert `.findobe` mit stabilen IDs, Gestaltung, Kommentaren, Vorschlägen und Verlauf. Das ursprüngliche Importdokument bleibt erhalten.

Agenten lesen und ändern das laufende Dokument über `scripts/findobe-agent.mjs`. Änderungen erscheinen im Editor, teilen dessen Undo/Redo und werden gegen veraltete Revisionen geprüft. **Agentenzugang** zeigt die lokale Verbindung. Es ist kein KI-Abonnement oder API-Schlüssel nötig.

In der linken Seitenleiste stehen Seitenlayout, Export als Findobe/DOCX/ODT/HTML/Markdown/Text/PDF und **PDF-Vorschau** in einem eigenen Findobe-Tab. Rechts stehen Kommentare, prüfbare Vorschläge und der Änderungsverlauf. Entwürfe werden lokal auf der Festplatte gesichert und können nach einem Neustart als Arbeitskopie wiederhergestellt werden.

Die vollständigen Funktionen, Agentenaufrufe, Dateiformat-Grenzen und Tests stehen in [DOCUMENT-CONTRACT.md](DOCUMENT-CONTRACT.md). Insbesondere ist PDF-Import eine Übernahme der Textschicht; komplexe Word-/ODT-Layouts werden nicht vollständig rekonstruiert. Eine vollständige Word-Funktionsparität oder Cloud-Zusammenarbeit zwischen mehreren Rechnern ist nicht enthalten.

## Benutzen

1. **Datei öffnen…** wählen oder eine Datei ins Fenster ziehen.
2. HTML: Text anklicken und bearbeiten; **Enter** übernimmt, **Esc** verwirft die Eingabe. Markdown: direkt im durchgehenden Editor schreiben, **Enter** fügt eine neue Zeile ein.
3. **Speichern** schreibt in die geöffnete Datei. **Speichern unter…** erstellt eine separate Datei im gleichen Format.
4. **Als PDF exportieren** öffnet die Druckvorschau des Betriebssystems. Am Mac unten **PDF → Als PDF sichern** wählen; unter Windows **Microsoft Print to PDF** als Drucker wählen.

Tastenkürzel: ⌘/Strg+O öffnen, ⌘/Strg+S speichern, ⌘/Strg+Shift+S speichern unter, ⌘/Strg+P PDF.

### Mehrere Dokumente als Tabs

Jede weitere Datei öffnet in einem eigenen Tab. **+** oder **Datei öffnen…** fügt einen Tab hinzu. Bereits geöffnete Dateien werden ausgewählt, nicht doppelt geöffnet. Der vollständige Dateipfad steht im Tooltip des Tabs.

- Ein Punkt markiert ungespeicherte Änderungen. Speichern, Suche und PDF-Export beziehen sich auf den aktiven Tab.
- Text, Rückgängig-Verlauf, Ansicht und Scrollposition bleiben beim Wechsel pro Dokument erhalten.
- **×** oder **⌘/Strg+W** schließt einen Tab; **Strg+Tab** / **Strg+Shift+Tab** wechselt zwischen Tabs. In der Tab-Leiste funktionieren auch Pfeiltasten, Home und End.
- Beim Schließen geänderter Tabs und beim Beenden gibt es **Speichern / Verwerfen / Abbrechen**. Fehlgeschlagenes oder abgebrochenes Speichern lässt den Tab offen. Wird das Beenden später abgebrochen, bleiben auch zuvor zum Verwerfen vorgemerkte Tabs erhalten.
- „Speichern unter“ darf keine Datei überschreiben, die in einem anderen Tab geöffnet ist.

Tabs bleiben nur während der laufenden Sitzung erhalten. Im gemeinsamen Dokumenteditor werden Entwürfe lokal gesichert und können nach einem Neustart wiederhergestellt werden; die ursprünglichen Editoren haben diese Wiederherstellung nicht.

### PDF-Text bearbeiten

PDF öffnen, eine Textstelle anklicken oder per **Tab** erreichen (**Pfeiltasten**, **Home/End** wechseln die Textstelle), mit **Enter/Leertaste** bearbeiten und mit **Enter** übernehmen; **Esc** verwirft die Eingabe. **Speichern** schreibt die Änderungen in die PDF, **Speichern unter…** bzw. **PDF-Kopie speichern…** erstellt eine separate PDF. Rückgängig/Wiederholen, Suche, Zoom und Dokument-Tabs funktionieren auch für PDFs. Es gibt keine automatische Umwandlung in HTML und keine über den alten Text gelegten weißen Textfelder.

Die Bearbeitung nutzt die vorhandene Schrift und Textposition. Nicht verfügbare Zeichen und zu lange Texte werden gemeldet; bei mäßiger Überbreite kann der Text eingepasst werden. Gesperrte Textstellen nennen den Grund per Tooltip und im zugänglichen Namen; Enter zeigt den Hinweis auch als Statusmeldung. Scans ohne Textschicht, verschlüsselte PDFs und bestimmte Schriftkodierungen sind nicht bearbeitbar. Kein OCR, freies Layout oder Bildeditor. Änderungen werden als PDF-Aktualisierung gespeichert; dies ist keine Schwärzungsfunktion und entfernt frühere Inhalte nicht sicher.

PDFs werden binär übertragen und atomar gespeichert. Undo/Redo erhält die Operatorbytes und berücksichtigt die letzte gespeicherte Baseline. Für die Anzeige bleiben alle Seitenplatzhalter und Textstellen erhalten; nur sichtbare Seiten, eine Seite Vorlauf in beide Richtungen und eine fokussierte Stelle halten Rasterpuffer. Das normale Fenster umfasst höchstens sechs Seiten; bei vielen gleichzeitig sichtbaren kurzen Seiten werden diese vollständig angezeigt. Die Canvas-Puffer teilen ein festes Budget von 64 MiB je aktivem PDF. Bei hohem Zoom/DPR kann die Rasterauflösung sinken; Schriftpositionen, Quelldaten und gespeicherte PDFs bleiben unverändert. Verdeckte PDF-Tabs geben ihre Canvas-Puffer frei. Das Budget begrenzt Rasterpuffer, nicht den gesamten Prozessspeicher oder die PDF-Parserdaten. Der Schutz vor externen Dateiänderungen und vor dem Überschreiben anderer offener Tabs gilt ebenso für PDF. Die macOS-Dateizuordnung ergänzt PDF als unterstütztes Format, ohne die Standard-App zu ändern.

### HTML-Vorschau

Bei geöffneten HTML-Dateien schaltet **Bearbeiten / Vorschau** zwischen dem Editor und einer Ansicht in voller Fensterbreite um. Die Vorschau zeigt die Originalgestaltung ohne Seitenleiste, Löschknöpfe und Editierhilfen. Sie enthält auch noch ungespeicherte Änderungen; erst **Speichern** schreibt diese in die Datei. Zurück zu **Bearbeiten** geht es ohne Verlust der Änderungen. Dokument-Skripte und Internet-Ressourcen bleiben in beiden Ansichten gesperrt. ⌘/Strg+F wechselt für die Dokumentsuche zurück in den Editor.

CSS-Kommentare mit HTML-Beispielen lassen die Gestaltung nicht mehr verschwinden: Stylesheets werden für die Anzeige getrennt vom bereinigten HTML geladen. Der gespeicherte Originalquelltext wird dadurch nicht umgeschrieben.

### Markdown schreiben

Auf macOS können `.md`- und `.markdown`-Dateien auch über Finder → Öffnen mit → FinDobe geöffnet werden, sowohl beim App-Start als auch bei laufender App. Weitere Dateien öffnen als Tabs, ohne vorhandene Änderungen zu verwerfen. Pro Öffnung eine Datei auswählen; Mehrfachauswahl wird mit einem Hinweis abgewiesen. Die App meldet ihre Unterstützung an, ändert beim Installieren aber keine Standard-App. Diese lässt sich bei Bedarf in Finder → Informationen → Öffnen mit → Alle ändern festlegen.

Die Umsetzung verwendet Tauri-Dateizuordnungen und gepufferte Betriebssystem-Ereignisse, damit Anfragen beim Kaltstart nicht vor der Initialisierung des Editors verloren gehen. [Tauri: Dateiübergabe](https://tauri.app/learn/mobile-file-associations/), [Dateizuordnungs-Konfiguration](https://v2.tauri.app/reference/config/#fileassociation).

- **Schreiben:** durchgehender Editor statt einzelner Textbausteine. `# ` bis `###### ` formatieren Überschriften, `**Text**` wird fett; `- ` beginnt eine Liste. Enter führt Listen weiter, Enter auf einem leeren Listeneintrag beendet sie. Die Syntax der aktuellen/markierten Zeilen bleibt sichtbar, grundlegende Formatierungszeichen anderer Zeilen werden ausgeblendet. Tabellen, Linkziele und Codeblock-Grenzen bleiben hier als Markdown bearbeitbar.
- **Quelltext:** vollständige Markdown-Syntax mit Zeilennummern in Geist Mono.
- **Vorschau:** schreibgeschützte Darstellung mit Überschriften, Listen, Tabellen, Links und Codeblöcken. Kein Editieren einzelner Textstellen; zum Schreiben zurückwechseln.

Neu referenzierte lokale Bilder werden vor Vorschau und PDF-Export nachgeladen; nach „Speichern unter“ gilt der neue Dokumentordner als Basis. Fehlende oder gesperrte Ressourcen erscheinen als Hinweis.

Alle Ansichten teilen denselben Text. Wechseln verändert weder Inhalt noch Rückgängig-Verlauf. ⌘/Strg+Z und ⌘/Strg+Shift+Z arbeiten in beiden Editieransichten; die Vorschau verändert nichts. ⌘/Strg+F öffnet die Suche. Speichern, Speichern unter und PDF verwenden auch die neuesten ungespeicherten Eingaben. Vorhandene Zeilenenden und UTF-8-BOM bleiben in unberührten Bereichen erhalten; neue Zeilen folgen dem ersten Zeilenende der Datei. Vollständige Undo-Schritte stellen auch gemischte ursprüngliche Zeilenenden wieder her. Es gibt keine automatische Markdown-Neuformatierung beim Ansichtswechsel.

Der Editor ist lokal gebündelt (CodeMirror); keine CDN-Abhängigkeit und keine Internetverbindung nötig. Dies ist kein vollständiger Obsidian-Nachbau: kein Vault, keine Plugins und keine Wikilink-Auflösung.

### Abschnitte entfernen

Die Umschalter **Inhalt / Texte** und die Textaktionen lassen sich mit **Enter/Leertaste** bedienen. In der HTML-Inhaltsliste steht unter jeder Überschrift **Abschnitt löschen…**. Erst die anschließende Bestätigung entfernt die Überschrift samt zugehörigem Inhalt. **Abbrechen**, **Esc** oder ein Klick außerhalb der Rückfrage heben die Auswahl auf. ⌘/Strg+Z macht das Löschen rückgängig; erst **Speichern** schreibt es in die Datei. Die schwebenden Pfeil-/X-Knöpfe im Dokument entfallen.

### Startbildschirm

„The Future is Now.“ erscheint in Geist Mono mit einer einmaligen Tippanimation von etwa anderthalb Sekunden. Die Bedienung bleibt währenddessen verfügbar. Bei aktivierter Systemeinstellung „Bewegung reduzieren“ erscheint der Text ohne Animation. Die App-Oberfläche verwendet keine Kursivschrift; die Gestaltung geöffneter Dokumente bleibt davon unberührt.

### macOS-Dateidialog: überlappende Datumsgruppen

Falls eine Datumsüberschrift wie „Yesterday“ den ersten Ordnernamen überlagert: Im Öffnen-Dialog oben im Gruppierungsmenü **None / Keine** wählen. Ohne Gruppierung war die Überlappung im lokalen Test auch nach erneutem Öffnen verschwunden. Das ist ein lokaler Workaround für die native Dialogansicht, kein programmseitiger Fix der Gruppendarstellung.

## Plattformen / Paketstand 0.3.0

Die Paket-/Installationsangaben beschreiben den dokumentierten Stand vom September 2026. Die Änderungen aus dem Implementierungsloop vom 02.10.2026 liegen im Checkout; die Nutzer-App wurde dabei nicht ersetzt.

- **macOS:** lokal gebaute und getestete Apple-Silicon-App; installiert unter `/Applications/FinDobe.app`. Mindestversion laut Build-Konfiguration macOS 12. Nicht mit Apple Developer ID signiert oder notarisiert; die Weitergabe auf andere Macs ist noch kein fertiger öffentlicher Release.
- **Windows:** x64-Programm erfolgreich cross-kompiliert. Das ZIP vollständig entpacken und `FinDobe.exe` starten; `WebView2Loader.dll` muss daneben bleiben. Microsoft Edge WebView2 Runtime wird benötigt. **Noch kein Laufzeittest unter Windows.** Die GitHub-Actions-Vorlage kann zusätzlich einen NSIS-Installer unter Windows bauen; sie wurde nicht ausgeführt.
- Ein Intel-Mac-Paket ist in dieser Lieferung nicht enthalten.

### Windows-MSI für Geräteverwaltung

Der zuletzt dokumentierte Windows-Paketstand ist MSI 0.3.0 vom 18.09.2026 mit Dokument-Tabs und PDF-Textkorrektur. Das bisherige portable Windows-ZIP und die installierte Mac-App wurden bei diesem Windows-Build nicht ersetzt.

`dist/FinDobe-0.3.0-x64.msi` ist als geräteweites x64-Pilotpaket mit stiller Installation, Startmenüeintrag und Upgrade-Regeln gebaut. WebView2 Evergreen Runtime muss geräteweit vorinstalliert sein. **Unsigniert und noch nicht unter Windows getestet.** Installationsbefehle, Erkennung und Pilot-Checkliste stehen in [packaging/windows/DEPLOYMENT.md](../packaging/windows/DEPLOYMENT.md). `npm run build:msi` baut und prüft das Paket aus dem aktuellen Windows-Payload.

## Bisherige Editoren: Umfang und Grenzen

FinDobe 0.3.0 ist für HTML ein visueller **Textkorrektur-Editor**, für Markdown ein durchgehender Schreib-/Quelltext-Editor mit Vorschau. Kein vollständiger Word-Ersatz und kein freier HTML-Seiten-Designer. Bestehende HTML-Gestaltung und Markdown-Syntax werden beim Bearbeiten möglichst quelltreu erhalten. Komplexe interaktive Webseiten, eingebettete Apps, JavaScript-generierte Inhalte und beliebige HTML-Layout-Umbauten gehören nicht zum unterstützten Umfang.

- Unterstützt `.html`, `.htm`, `.pdf`, `.md`, `.markdown`, `.txt`; Textdateien in UTF-8, PDFs binär, maximal 30 MB je Datei. `.txt` wird als Markdown dargestellt.
- Dokumente werden lokal verarbeitet; keine Cloud, keine Anmeldung, keine KI-API.
- Dokument-Skripte werden in der Ansicht nicht ausgeführt. Internet-Ressourcen werden nicht nachgeladen. Eingebettete Bilder/Schriften und unterstützte relative Ressourcen im Dokumentordner funktionieren; Ressourcen außerhalb dieses Ordners und CSS-`@import` werden nicht nachgeladen. Das kann das Aussehen fremder HTML-Dateien verändern.
- Änderungen an der Datei durch andere Programme werden vor dem normalen Speichern erkannt und nicht still überschrieben. Das ersetzt keine Backups und ist kein vollständiger Schutz gegen zeitgleiche Schreibvorgänge.
- PDF verwendet das Drucklayout des Dokuments und den Systemdialog. Seitenumbrüche hängen vom Dokument ab.

## Entwicklung

Rust / Tauri 2 übernimmt Fenster, Dateizugriff, Systemdialoge, Schreibschutz und PDF-Druck. Die eingebettete WebView stellt Dokumente dar; der visuelle Editor ist JavaScript. Damit ist FinDobe eine installierbare Desktop-App, aber ausdrücklich keine vollständig in Rust geschriebene Rendering-Engine.

```sh
npm ci
npm run build:editor
npm run dev
npm test
# Browser-Smokes (Python 3 und playwright-cli mit installiertem Chromium):
npm run test:browser
# Auf macOS:
npx tauri build --bundles app,dmg
# Auf Windows mit Rust/MSVC und WebView2:
npx tauri build --bundles nsis
```

Voraussetzungen und Plattform-Toolchains: [Tauri-Dokumentation](https://v2.tauri.app/start/prerequisites/).

`tests/demo.html` und `tests/demo.md` sind synthetische Beispieldateien. `tests/editor-smoke.js` ist ein Playwright-CLI-Test mit simulierten Systemdialogen; Browser-Bearbeitung und native Dateioperationen werden getrennt geprüft. `npm run test:browser` startet einen eigenen Loopback-Server für `ui/` auf Port 17893, führt alle acht Smokes in frischen Chromium-Sessions aus und beendet Server und Sessions. Ein bereits belegter Port wird nicht übernommen. Ergebnisse liegen unter `test-results/browser-smokes/`; einzelne Tests z. B. mit `npm run test:browser -- pdf review-fixes pdf-cache` ausführen. `TESTREPORT.md` dokumentiert die tatsächlich ausgeführten Prüfungen.

Der neue Markdown-Editor liegt in `frontend/markdown-editor.js`; `npm run build:editor` erzeugt das lokale Browser-Bundle samt Lizenzen. Tauri ruft diesen Schritt vor Entwicklung und Release-Build automatisch auf. `tests/markdown-smoke.js` prüft die drei Ansichten, Listenfortsetzung, Quelltreue, Undo/Redo, Speichern und HTML-Abgrenzung. THE-FIN-Logo und Schriften stammen aus den bereitgestellten Markenunterlagen. DOMPurify-Lizenz liegt in `ui/assets/DOMPurify-LICENSE`, die Markdown-Editor-Lizenzen in `ui/assets/Markdown-editor-LICENSES.txt`; weitere gebündelte Bibliotheken behalten ihre Lizenzhinweise.

### Version 0.3.0 – 18.09.2026

PDF-Textkorrektur ist nun im neuen Windows-MSI enthalten: `dist/FinDobe-0.3.0-x64.msi`. Paketinhalt und Upgrade-Metadaten von 0.2.0 auf 0.3.0 sind statisch geprüft. Windows-Laufzeit-/Installationstest und Signierung stehen weiterhin aus. WebView2 muss geräteweit vorhanden sein. [Deployment-Anleitung](../packaging/windows/DEPLOYMENT.md) und [künftige Update-Verteilung](../packaging/UPDATES.md).
