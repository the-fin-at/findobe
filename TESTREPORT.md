# FinDobe – Prüfberichte

## Implementierungsloop 2 – 02.10.2026

- F01–F06 im vorhandenen Hauptcheckout behoben. Ausgangsbasis mit 105 Source-Fingerprints und Kopien gesichert; Änderungen dieses Loops separat in `.herdr-project/findobe-t-0002/library/loop2-only.patch` und `source-accounting.json` ausgewiesen. Kein Commit, Stash, Reset, Push, Merge, Release oder Ersetzen der installierten App.
- Finale `npm test`-Ausführung: Rust 6/6 und Node-Dateiübergabe 7/7 bestanden. Editor-Bundle und native macOS-Debug-App erfolgreich gebaut. Keine frühere Testausführung als aktuellen Nachweis übernommen.
- Alle acht Browser-Smokes bestanden: editor, preview, markdown, usability, tabs, pdf, review-fixes, pdf-cache. Neuer gemeinsamer Einstieg `npm run test:browser` startet und beendet einen eigenen Loopback-Server und frische Chromium-Sessions. Tauri-Aufrufe in diesen Tests sind simuliert.
- Regressionen: Save/Save As aus fünf HTML-Fokusbereichen jeweils genau einmal; Abbruch/Fehler erhalten Inhalt und Dirty-Marker; parallele Save-Aufrufe ausgeschlossen. HTML-Textliste per Enter/Leertaste, Esc und Tab bedienbar, auch nach Abbruch. PDF-Textstellen mit zugänglichen Namen, einem gemeinsamen Tastatureinstieg und Pfeil-/Home-/End-Navigation; gesperrte Gründe und Fehlermeldungen zugänglich. PDF-Undo/Redo bytegleich vor der ersten Änderung und gegenüber der gespeicherten Baseline, auch über Seiten/Tabwechsel und mit Tz-Einpassung. Neue/Unicode-Markdown-Bilder in Vorschau/Export; neuer Ressourcenordner nach Save As, Deduplizierung, veraltete Render-Ergebnisse und Tabwechsel geprüft. Internet/Traversal weiter gesperrt; kaputtes PDF meldet verständlichen Fehler ohne Tab-/Handle-Leak.
- F06: 100 A4-Seiten, 1.240 × 900 px, DPR 1 und 2, zwei PDF-Tabs. Höchstens vier aktive Canvas-Puffer gemessen; Peak jeweils 67.077.696 Bytes RGBA (63,97 MiB), unter dem festen 64-MiB-Budget. Verdeckte Tabs halten null Rasterpuffer. Scrollen, Zoom bis 3,8, Fokus, Änderung einer späteren Seite, Eviction/Undo/Redo/Save/Reopen und Suche außerhalb des gerenderten Fensters bestanden. Zusätzlich alle gleichzeitig sichtbaren kurzen Seiten innerhalb des Bytebudgets angezeigt. Bei unverändertem Fit keine erneute Layoutberechnung; Rasterjobs serialisiert. Die Zahlen sind Canvas-Pufferrechnung, keine Prozess-RSS-Messung. Parser-/Text-/Overlaydaten bleiben für alle Seiten erhalten; bei Budgetdruck sinkt nur die Rasterauflösung.
- Nativer F01-Test: aktueller isolierter Debug-Build `FinDobe Loop2 Test.app`, eigene Bundle-ID nur über temporären Build-Override, keine Dateiassoziationen. Wegwerf-HTML über echten macOS-Öffnen-Dialog geladen, Text geändert, Fokus im HTML-Dokument belassen, ⌘Shift+S, echten Save-As-Dialog abgebrochen. Originalhash vor, während und nach dem Dialog identisch; Änderung und Dirty-Marker erhalten. Undo/Redo anschließend sichtbar erfolgreich, normales ⌘S schreibt ausschließlich die beabsichtigte Textkorrektur mit unverändertem BOM/CRLF/übrigem Quelltext. Test-App danach beendet; installierte Nutzer-App blieb als separater Prozess bestehen. CUA-Tastensynthese berücksichtigt die lokale Y/Z-Belegung; keine vollständige native Tastaturabnahme behauptet.
- **Noch nicht ausgeführt:** Windows/WebView2-Laufzeit, Installation/Upgrade, vollständige VoiceOver-/Windows-Screenreader-Prüfung, native PDF-/Markdown-/Druckdialog-Abnahme und breiter PDF-/Font-/Erzeuger-Korpus. Kein Gesamt-RSS-/Langzeit-Speichertest. Optionale Adapter-/Architekturaufteilung nicht begonnen.
- Befunde-zu-Fixes-Tabelle, Vorher-/Nachher-Screenshots, native Hashbelege und vollständige Logs: `.herdr-project/findobe-t-0002/report.md` und dessen `library/`.

## Historischer Prüfstand FinDobe 0.1 – 16.09.2026

## Windows-MSI 0.2.0 – 17.09.2026

- Gemeinsame Quellversion in npm, Cargo, Tauri und sichtbarer Editor-Fußzeile auf 0.2.0 angehoben. Neu gebaut mit `npx tauri build --target x86_64-pc-windows-gnu --no-bundle`; enthält die Tabs-Oberfläche (`tabs.html`). Die installierte Mac-App wurde nicht ersetzt.
- Windows-EXE und WebView2Loader als PE32+ x64 geprüft; EXE-FileVersion und ProductVersion jeweils `0.2.0.0`. Nur Windows-System-DLLs plus beigelegter WebView2Loader als direkte Imports. EXE weiterhin ohne Authenticode-Signatur.
- `npm test`: Rust 5/5 und Node 7/7 bestanden. Keine erneute Browser-/native Mac-UI-Prüfung für die reine Versions-/Paketierungsänderung.
- MSI gebaut und mit `node scripts/verify-msi.mjs dist/FinDobe-0.2.0-x64.msi dist/FinDobe-0.1.0-x64.msi` geprüft: ALLUSERS=1, x64, ProgramFiles64Folder, HKLM-Registryerkennung, WebView2-Voraussetzung, Upgrade-/Downgrade-Grenzen und RemoveExistingProducts innerhalb der Transaktion. Vier extrahierte Nutzdateien stimmen bytegenau mit den Build-Dateien überein.
- UpgradeCode unverändert `{BA217E1B-A2DB-489B-AE18-30D30C93D851}`; ProductCode neu `{825F0483-FE0D-562C-83CD-20DF0F38A1B1}`; PackageCode neu `{FA3C12DB-BBAE-492D-B387-E5704FEB0F1D}`. Bestehende Komponenten-GUIDs gegenüber MSI 0.1.0 unverändert. Tatsächlicher Upgrade-/Rollback-/Downgrade-Test auf Windows bleibt erforderlich.
- `FinDobe-0.2.0-x64.msi` SHA-256: `04a4b4184db514a6615ea7e06c57c961e7dab909a731a6949e8f50c9fe7dcb7a`. Versionsbezogenes Manifest und Deployment-Anleitung mit Installations-/Deinstallationsbefehlen und Erkennungsregeln aktualisiert. Voriges MSI 0.1.0 unverändert erhalten.
- **Grenzen:** MSI/EXE unsigniert, kein Windows-Laufzeit-/Installations-/ICE-Test, kein tatsächliches Device-Management-Deployment, kein GitHub-Push. Das ist ein statisch geprüftes Pilotpaket, keine Freigabe für den breiten Rollout.

## Tabs-Update 17.09.2026

- Gemeinsame Tab-Leiste mit getrennten, lebenden Editor-Instanzen. Änderungen, Undo/Redo, Ansichten und Scrollposition bleiben pro Dokument erhalten. Gleiche kanonische Pfade werden nicht doppelt geöffnet. Schließen mit Speichern/Verwerfen/Abbrechen; fehlgeschlagene Saves lassen Tabs offen. Ein späteres Abbrechen des Beendens verwirft keine vorher vorgemerkten Tabs.
- `npm test`: Rust 5/5, Node 7/7 bestanden. Neuer Rust-Test schützt Speichern-unter-Ziele anderer offener Dokumente. Syntaxprüfungen und `git diff --check` bestanden.
- `tests/tabs-smoke.js` über Playwright/Chromium mit simulierter Tauri-Grenze bestanden: getrennte Undo-Verläufe, BOM/gemischte Zeilenenden, Scrollposition nach Wechsel, doppelte Pfade, gleiche Dateinamen, Save-Ziel, Save-as-Umbenennung und Abbrechen, Fehler beim Öffnen/Speichern, Finder-Queue, HTML/MD-Vorschau, Export des aktiven Tabs, Shortcuts, alle Schließentscheidungen und Freigabe der Dokument-Handles. Keine JavaScript-Laufzeitfehler.
- Bestehende `tests/markdown-smoke.js` und `tests/preview-smoke.js` erneut bestanden. Zusätzliche Prüfung mit zehn Tabs: nur die Tab-Leiste scrollt horizontal, keine Verbreiterung des Fensters. Screenshots bei 1240 und 880 Pixeln unter `.playwright-cli/tabs-*.png` visuell geprüft.
- Native Mac-App: Datei im Dialog öffnen, zweiten Markdown-Tab per Finder bei ungespeichertem ersten Tab öffnen, wechseln, Änderungspunkte und Text kontrollieren. ⌘W fragt nur für den aktiven zweiten Tab; Abbrechen erhält beide; Speichern und Schließen schreibt nur die zweite Testdatei. Disk-Inhalte zurückgelesen. Finder-Kaltstart mit Markdown ebenfalls erfolgreich.
- Dabei ein vorhandenes Problem des vordefinierten macOS-Quit-Menüs reproduziert: ⌘Q und `Quit FinDobe` beendeten direkt über Cocoa `terminate:` ohne die Rückfrage. Eigenen Menüpunkt eingebaut, der die zentrale Tab-Prüfung aufruft; neu kompiliert. **Abschließender nativer Test dieses Beenden-Fixes noch offen: Mac während der Prüfung gesperrt.** Repro/Prüfschritte in `tests/native-tabs-checklist.md`. Keine behauptete Absicherung für erzwungenes Beenden, Dock-Beenden oder System-Shutdown.
- Finaler Mac-Build installiert unter `/Applications/FinDobe.app`, lokal ad-hoc signiert, Signatur geprüft. SHA-256 des installierten Programms: `a118087ad5004c56c79cc51db5a74c64ad52a594901074ce854a352db94cddba`. Vorheriger Build und Zwischenbuild wiederherstellbar unter einem lokalen Sicherungsordner.
- ZIP in Downloads und `dist/` aktualisiert und Archivintegrität geprüft. Markdown-Standardzuordnung nach Installation unverändert auf `/Applications/FinDobe.app` zurückgelesen. Weiterhin keine Developer-ID-Signierung/Notarisierung. Windows-Pakete unverändert, kein Windows-Laufzeittest, kein GitHub-Push. Keine automatische Entwurfssicherung oder Wiederherstellung von Tabs nach Neustart.

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

Mac-Binärdatei des ursprünglichen 0.1-Builds SHA-256: `b8da98702ea2e9aceca18e3d9844dd7e79543482fd0428db01354ee62aba9635`

## Ergänzung: HTML-Vorschau (16.09.2026)

Ursache des ungestalteten HTML: DOMPurify entfernt einen gesamten Style-Block, wenn ein CSS-Kommentar HTML-artigen Text wie `<body class="intern">` enthält. Ein minimaler reproduzierbarer Test schlug zunächst mit `CSS comment removed document layout: rgba(0, 0, 0, 0)` fehl. CSS wird nun für die Ansicht als separate lokale Data-Stylesheets eingebunden; HTML-Bereinigung und restriktive Dokument-CSP bleiben aktiv. Der Originalquelltext wird unverändert als Bearbeitungsbasis behalten.

- `tests/preview-smoke.js` in frischem Playwright-Chromium: bestanden. CSS-Kommentar, berechnete Farben/Schriften, schreibgeschützte Vorschau, laufende Eingabe beim Wechsel übernehmen, ungespeicherte Änderungen anzeigen, exakter Quelltext beim Speichern aus der Vorschau, zurück zum Bearbeiten, Undo-Sperre in Vorschau und Rücksetzen beim Öffnen von Markdown.
- `tests/editor-smoke.js`: weiterhin bestanden; keine JavaScript-Laufzeitfehler in beiden Testläufen.
- `cargo test`: 3/3 bestanden; JavaScript-Syntaxprüfungen und `git diff --check` bestanden.
- Konkrete Infoabend-Datei: ursprünglicher Darstellungsfehler im Browser reproduziert; nach dem Fix Hintergrund `rgb(245, 241, 232)` und Geist-Schrift bestätigt. Das Originaldokument ist unverändert (SHA-256 mit Testkopie verglichen).
- Native macOS-Release-App: gleiche Datei als Testkopie geöffnet, Umschalten auf Vorschau visuell geprüft, vollständige Gestaltung ohne Seitenleiste und Editierhilfen sichtbar. Anklicken von Text startet dort keine Bearbeitung. PDF-Systemdialog aus Vorschau öffnet mit drei gestalteten Seiten; kein Druckauftrag gesendet.
- Zusätzlich: Bedienleiste bei 880 Pixel Breite ohne Überlauf; ⌘F wechselt in den Editor. PDF-Vorbereitung wartet auf die Stylesheets vor dem Druckaufruf (berechnete Schriftgröße und Hintergrund im Browser überprüft).
- Windows weiterhin nur Build-Prüfung, kein Windows-Laufzeittest.

Screenshot der Browser-Vorschau: `test-results/html-preview.png`. Der Ordner bleibt lokal und ist nicht Teil des Git-Repositories.

Aktualisierte Mac-App installiert und Originaldatei in der Vorschau geöffnet. Installierter Release-Build SHA-256: `939c6dc90cd44655c0400f759fe322af781a10c978f47c7f7a00fb261aee697d`. Die vorherige App liegt als lokale Rückfallkopie unter `test-results/FinDobe-before-preview.app`.

## Ergänzung: Startbildschirm und Abschnitt-Auswahl (16.09.2026)

- Schwebende Pfeil-/X-Knöpfe entfernt. Die Inhaltsliste verwendet eine beschriftete Aktion mit Bestätigungsdialog; Esc, Abbrechen und Klick außerhalb entfernen die temporäre Markierung.
- Startbildschirm ohne Werbesätze und Kursivschrift. „The Future is now“ in Geist Mono; einmalige, nicht blockierende Tippanimation. Bei reduzierter Bewegung statische Darstellung. Dokumentgestaltung bleibt unverändert.
- `tests/usability-smoke.js` in frischem Playwright-Chromium mit simulierten nativen Aufrufen: Animation und berechnete Schrift, reduzierte Bewegung, expliziter Öffnen-Knopf, keine schwebenden Löschknöpfe, alle drei Abbruchwege, anschließende Textbearbeitung, bestätigtes Löschen, Rückgängig und quelltreues Speichern bestanden. Keine JavaScript-Laufzeitfehler.
- Animation zusätzlich über aufeinanderfolgende Renderframes geprüft: teilweise sichtbarer Text während des Tippens, vollständiger Text nach Abschluss, Öffnen-Knopf durchgehend verfügbar. Screenshot: `test-results/startscreen-mono.png`.
- `tests/editor-smoke.js` und `tests/preview-smoke.js` erneut bestanden; Rust-Tests 3/3 bestanden. JavaScript-Syntaxprüfungen und `git diff --check` bestanden.
- macOS- und Windows-x64-Release-Builds erfolgreich. Windows weiterhin ohne Laufzeittest. Der letzte native Sichtcheck dieser UI-Änderungen ist offen: Der Mac war nach der Installation gesperrt, daher wurde die neue App nicht per UI geprüft. Die oben genannten nativen Prüfungen betreffen vorherige Builds.
- Vorherige Mac-App als Rückfallkopie: `test-results/FinDobe-before-ux.app`. Änderungen bleiben lokal, kein GitHub-Push in diesem Arbeitsschritt.
- Aktualisierte App unter `/Applications/FinDobe.app` installiert. Installierte Binärdatei und Release-Build stimmen überein: SHA-256 `a3268f7a455e8fb16a1d46a67e63133447518462e697f590a1e6c8c18d72c070`.

## Ergänzung: Datumsgruppen im macOS-Dialog und Starttext (16.09.2026)

- Native Reproduktion: Datei öffnen → Favorit einen lokalen Workshop-Ordner. „Yesterday“ überlagert „tmp“ in der gruppierten Listenansicht; Screenshot und Accessibility-Zustand bestätigen das Nutzersymptom.
- Einzige veränderte Variable: Gruppierungsmenü → None. Ordnername danach frei lesbar; auch nach Abbrechen und erneutem Öffnen bleibt die ungruppierte Darstellung erhalten. Keine Dateien verändert. Das ist ein lokaler Ansichts-Workaround, kein allgemeiner Bugfix der nativen Gruppendarstellung; die genaue Ursache innerhalb von macOS/Dialog-Anbindung bleibt unbestimmt.
- Dieser native visuelle Fehler wurde per Computer-Use-Schritten vor/nach der Änderung geprüft, nicht durch einen automatisierten Browser-Regressionscheck: Der Systemdialog liegt außerhalb des Web-DOM. Keine Rust-Dialoglogik auf Verdacht geändert.
- Starttext auf „The Future is Now.“ geändert; Breite und Tippanimation auf 18 Zeichen angepasst.
- `tests/usability-smoke.js` erneut bestanden: genauer Starttext, Animation, reduzierte Bewegung sowie Lösch-/Abbruch-/Rückgängig-Verhalten; keine JavaScript-Laufzeitfehler. `git diff --check` und Syntaxprüfungen bestanden.
- Neue Mac-App installiert und gestartet; vollständiger Schriftzug inklusive Punkt nativ visuell geprüft. Installierter Build entspricht dem Release-Build, SHA-256 `a1ffb8eb2417576f21ce8947988df0b7fbdd2b361525147883265f7600574c91`. Eine weitere Dialogprüfung nach App-Neustart wurde nicht durchgeführt, weil der Nutzer inzwischen ein Dokument geöffnet hatte; dessen Arbeit blieb unberührt.
- macOS- und Windows-Pakete neu gebaut und aktualisiert. Windows weiterhin nur Build-geprüft. Kein GitHub-Push.

## Ergänzung: durchgehender Markdown-Editor (16.09.2026)

- Neuer lokal gebündelter CodeMirror-Editor mit Schreiben, Quelltext und schreibgeschützter Vorschau. Native Öffnen-/Speichern-/PDF-Schnittstellen bleiben gleich; HTML behält seinen bisherigen Editor.
- `tests/markdown-smoke.js`: neue Überschriften beim Tippen, Enter-Listenfortsetzung, drei Ansichten, fett und Tabellen in Vorschau, BOM und gemischte Zeilenenden beim unveränderten Speichern unter, fortgesetztes Schreiben, Speichern aus Vorschau, PDF-Inhalt, Rückgängig/Wiederholen, Schutz ungespeicherter Änderungen, fehlgeschlagenes Speichern, Suche, leere Datei und Wechsel zu HTML bestanden. Keine JavaScript-Laufzeitfehler. Browser-Tests verwenden simulierte native Dialog-/Dateiaufrufe.
- Zusätzlicher Gruppierungsfehler bei Undo reproduziert und korrigiert: CodeMirror fasst mehrere inverse Effekte in einer Historiengruppe zusammen. Maßgeblich ist der letzte Rohtext-Snapshot dieser Gruppe, nicht der erste. Regressionstest vergleicht nach mehreren Undo-/Redo-Schritten sichtbaren Quelltext, Original einschließlich gemischter EOLs und kanonischen Speicherinhalt.
- `tests/editor-smoke.js` auf den neuen Editor angepasst und bestanden; `tests/preview-smoke.js` mit bisheriger HTML-Quelltreue und CSS-Regressionsprüfung bestanden. Rust weiterhin 3/3 Tests erfolgreich. `npm audit --omit=dev`: keine gemeldeten Schwachstellen.
- Browser-Sichtprüfung Schreiben: Überschriften, Fett, Listen und Zitate formatiert; Codeblock-Grenzen und Tabellen-Markdown bleiben editierbarer Text. Vollständig gesetzte Tabellen gibt es in Vorschau. Screenshot `test-results/markdown-write.png`. Kein horizontaler Fensterüberlauf bei 1280 Pixeln.
- Kein Obsidian-Vault-/Plugin-System und keine Wikilink-Auflösung. Der native Dateidialog-Workaround aus dem vorherigen Abschnitt bleibt unverändert.
- Abschlussprüfung zusätzlich: Tastenkürzel hinter offenem Bestätigungsdialog verändern den Inhalt nicht; Skripte, Event-Handler und JavaScript-Links aus Markdown werden aus der Vorschau entfernt, der gespeicherte Originaltext bleibt dabei unverändert. Ein zwischenzeitlicher Testlauf scheiterte an abgebrochenen Ressourcenabrufen des lokalen Testservers; erneuter Lauf in frischer Session mit vollständig geladenen Ressourcen bestanden.
- Vorschau und Quelltext visuell geprüft, auch bei 880 Pixeln ohne horizontalen Fensterüberlauf. Screenshots: `test-results/markdown-preview.png`, `test-results/markdown-source.png`, `test-results/markdown-narrow.png`.
- macOS- und Windows-x64-Release-Build erfolgreich; beide ZIPs aktualisiert. Neue Mac-Binärdatei SHA-256 `5649e6dfc2bc4a79152472ce1246e2859a84b88661153933b7035396b46a4a7b`. **Noch nicht installiert und nicht nativ getestet:** Die laufende Nutzer-App bleibt bis zur Freigabe des Neustarts unberührt; `/Applications/FinDobe.app` enthält weiterhin den vorherigen Build. Windows weiterhin ohne Laufzeittest. Kein GitHub-Push.

## Ergänzung: Windows-MSI für Geräteverwaltung (16.09.2026)

- `dist/FinDobe-0.1.0-x64.msi` lokal mit wixl/msitools 0.106 gebaut. Keine Remote-Builds, kein GitHub-Push, keine Änderung der laufenden Mac-App.
- `scripts/verify-msi.mjs` bestanden: x64-Summary, ALLUSERS=1, ProgramFiles64Folder, fünf x64-Komponenten, HKLM-Produktwert, WebView2-Maschinenprüfung in 32-Bit-Registryansicht, drei Startbedingungen, sichere Properties, Suche vor Startbedingungen, Entfernung älterer Versionen nach InstallInitialize/vor ProcessComponents, Upgrade-/Downgrade-Tabellen, Startmenüziel und eingebettetes Cabinet.
- MSI mit msiextract entpackt: vier Nutzdateien vorhanden; EXE, Loader-DLL und beide Lizenzdateien stimmen anhand SHA-256 mit den Paketquellen überein. EXE entspricht dem aktuellen Windows-Release-Build.
- ProductCode `{30304E6B-5FF7-5DEA-B68A-022D2EBBFF32}`, UpgradeCode `{BA217E1B-A2DB-489B-AE18-30D30C93D851}`. Endgültige Prüfsummen im begleitenden Manifest.
- Rollout-Anleitung: `packaging/windows/DEPLOYMENT.md`, als Kopie `dist/FinDobe-MSI-Rollout.md`.
- **Grenzen:** unsigniert; keine Windows-Installer-/ICE-Validierung, keine praktische Windows-Installation/-Deinstallation/-Reparatur/-Upgrade-Prüfung, kein Windows-App-/Drucktest und keine Intune-Zuweisung getestet. Vor breitem Rollout Pilot-Abnahme und Signierung durchführen.

## Ergänzung: lokale Mac-Installation aktualisiert und Altversionen entfernt (16.09.2026)

- Ursache des fehlenden Markdown-Editors: `/Applications/FinDobe.app` enthielt noch den Build vor dem Markdown-Umbau (`a1ffb8eb…`), während das aktuelle Release-Bundle bereits vorlag. Vorher nativ mit `tests/demo.md` reproduziert: alte Textbausteinansicht ohne Schreiben-/Quelltext-Reiter.
- App regulär ohne ungespeicherte Nutzerdokumente beendet, aktuelles Release-Bundle nach Programme übernommen. Dessen bestehende Bundle-Signatur bestand die Ressourcenprüfung nicht; die Installationskopie lokal ad-hoc neu signiert, anschließend `codesign --verify --deep --strict` erfolgreich. Keine Developer-ID-Signierung/Notarisierung. Installierte Binärdatei SHA-256: `306f0f5bbd1fc241091e2e1a032d4d782c7fde92358213fc7f3f8e93b27ac37b`.
- Fünf alte App-Bundles wiederherstellbar nach `~/.Trash/FinDobe-Altversionen-20260916-1410/` verschoben: vorherige Programme-Installation, drei `FinDobe-before-*`-Sicherungen aus test-results und altes Debug-Bundle. Quellprojekt, aktuelle Release-Artefakte, Windows-Pakete und Dokumente erhalten.
- Neue App tatsächlich aus `/Applications/FinDobe.app` gestartet. Nativ mit demselben Markdown-Beispiel: Schreiben, Quelltext und Vorschau sichtbar; direkte Eingabe `# Markdown-Test` möglich, Vorschau zeigt diese als H1, Quelltext zeigt die Markdown-Syntax. Testeingabe nicht gespeichert, verworfen und Originaldatei erneut geöffnet; Abschlusszustand Schreiben / Keine Änderungen. Kein erneuter vollständiger Speichern-/Druck-/Undo-Test in diesem Arbeitsschritt.

## Ergänzung: Markdown als macOS-Standard und Finder-Dateiübergabe (16.09.2026)

- macOS-spezifische Dateizuordnung für `.md`/`.markdown`, Typ `net.daringfireball.markdown`, Rolle Editor, Rang Alternate. Andere Plattform-Installer und fremde Dateitypen unverändert. Der App-Build setzt keine Standard-App automatisch.
- `RunEvent::Opened` nimmt lokale Datei-URLs entgegen. Rust puffert sie bis zum Abruf durch den Editor; dieser registriert zuerst den Listener und leert danach die Warteschlange. Finder-Anfragen während anderer Operationen werden zurückgestellt; Mehrfachauswahl erhält einen Hinweis statt still nacheinander Dokumente zu ersetzen. Bestehende Dateivalidierung und Rückfrage bei ungespeicherten Änderungen bleiben zuständig.
- Rust-Tests 4/4, Node-Tests 7/7 bestanden: Unicode-/Leerzeichen-/Raute-Pfade, Remote-URL-Ausschluss, Kaltstart, serialisierte Folgeanfragen, Busy-Zustand, Mehrfachauswahl, Fehlererholung sowie Abbrechen ohne Dateizugriff. JavaScript-Syntax und Diff-Whitespace geprüft.
- Mac-App neu gebaut, Installationskopie lokal ad-hoc signiert und unter `/Applications/FinDobe.app` installiert. Vorheriger installierter Build wiederherstellbar im Papierkorb unter `FinDobe-vor-Dateizuordnung.FbqXF8`. Weiterhin keine Developer-ID-Signierung/Notarisierung.
- Systemzuordnung vorher: `com.sublimetext.4` / `/Applications/Sublime Text.app`. Nach expliziter Nutzerbestätigung des macOS-Dialogs: `at.the-fin.findobe` / `/Applications/FinDobe.app`. Mit NSWorkspace/LaunchServices zurückgelesen. `.md` und `.markdown` teilen denselben Dateityp; HTML/TXT-Zuordnungen nicht geändert.
- Nativ: Finder-Doppelklick auf README.md bei beendeter App startet FinDobe und lädt genau dieses Dokument in den Markdown-Editor. Prozesspfad `/Applications/FinDobe.app/Contents/MacOS/findobe` bestätigt. Zweiter Finder-Doppelklick auf TESTREPORT.md bei laufender App und ungespeicherter Testeingabe zeigt Rückfrage; Abbrechen erhält README und Eingabe, erneuter Aufruf mit Verwerfen öffnet TESTREPORT.md / Keine Änderungen. Testeingabe nicht gespeichert.
- ZIP in Downloads aktualisiert und Archivintegrität geprüft. Windows-MSI/-ZIP unverändert, kein GitHub-Push. Keine erneute vollständige PDF-/Speicherprüfung in diesem Arbeitsschritt.


## PDF-Textkorrektur – 17.09.2026

- Rust: 6 Tests bestanden, einschließlich binärem PDF-Roundtrip, Base64-/Formatvalidierung und Schutz vor externen Änderungen.
- Dateiübergabe: 7 Node-Tests bestanden.
- Browser: PDF-, Tabs-, HTML-, Vorschau- und Markdown-Smokes bestanden. Der neue PDF-Test prüft Speichern aus einem offenen Textfeld, Tabwechsel, Undo/Redo, fehlgeschlagenes und abgebrochenes Speichern, Speichern unter, Duplikaterkennung sowie erneutes Öffnen der gespeicherten PDF.
- Gespeicherte PDF unabhängig mit pypdf gelesen und mit Poppler gerendert; geänderte erste Zeile und unveränderte zweite Zeile überprüft. Browserdarstellung ebenfalls visuell geprüft.
- Diese Tests decken nicht alle PDF-Erzeuger, Schriftkodierungen oder gescannte Dokumente ab. Kein Windows-Laufzeittest dieser Erweiterung.

- Mac-App erfolgreich mit PDF-Dateizuordnung gebaut und lokal ad-hoc signiert; Signaturprüfung bestanden. Bestehende laufende App unter `/Applications/FinDobe.app` nicht ersetzt. Kein nativer Ende-zu-Ende-Test dieser neuen App; Oberfläche im Browser und Dateiverarbeitung separat geprüft.

## Release 0.3.0 – 18.09.2026

- Windows-x64-Build und Mac-App neu gebaut. MSI-Paketdatenbank, vier extrahierte Dateien und Upgrade-Metadaten 0.2.0 → 0.3.0 geprüft: bestanden. Keine Windows-Laufzeit-/Installationsprüfung; MSI weiterhin unsigniert.
- Mac-App lokal ad-hoc signiert und nach sauberem Beenden der alten App unter `/Applications/FinDobe.app` installiert. Vorige App gesichert unter `dist/mac-backups/20260918-161601/FinDobe.app`. Version 0.3.0, Binärgleichheit mit Build und Signatur geprüft.
- Installierte Mac-App gestartet, Test-PDF über nativen Dateidialog geöffnet, Inhalt visuell geprüft und Tab wieder geschlossen. App bleibt geöffnet. Keine Änderungen an Nutzerdateien oder Standard-Dateizuordnungen.
- Dateiübergabe: 7 Node-Tests bestanden.

## Gemeinsame Dokumentbearbeitung 0.4.0 — 14.10.2026

Die Erweiterung verbindet den visuellen Editor und den lokalen Agentenzugang mit demselben ProseMirror-Dokument. `.findobe` speichert Inhalt, stabile IDs, Layout, Kommentare, Vorschläge und Verlauf. DOCX, ODT, HTML, Markdown, Text und PDF werden über explizite Import-/Exportwege verarbeitet. PDF-Import übernimmt die Textschicht; die ursprünglichen Editoren bleiben verfügbar.

### Ausgeführte Prüfungen

- `npm test`: **8 Rust-Tests und 13 Node-Tests bestanden**. Dazu gehören native Konflikt- und Dateischutzprüfungen, Authentifizierung/Origin-Abweisung des lokalen Zugangs, native Dateiübergabe sowie Dokumentmodell-/Schema- und Baustein-Voraussetzungen. Die Bausteinvergleiche sind unabhängig von der Reihenfolge der JSON-Schlüssel.
- `npm run test:browser`: **alle 9 Testgruppen bestanden** (`editor`, `preview`, `markdown`, `usability`, `tabs`, `pdf`, `review-fixes`, `pdf-cache`, `document`). Der neue Ablauf prüft echte Tastatureingaben neben Agentenänderungen, konfliktfreie Änderungen an anderen Bausteinen, Abweisung veralteter Änderungen, atomare Batches, gemeinsame Undo/Redo, Kommentare, Vorschläge, Metadaten, Wiederherstellung und wieder bearbeitbare Formatdurchläufe. Er prüft außerdem PDFs mit vollständig ausgesetzten `requestAnimationFrame`-Callbacks, wie sie in einer verdeckten nativen WebView auftreten können.
- Native Mac-App, über den echten lokalen HTTP-Zugang und die echten Rust-Dateioperationen: **41 Checks bestanden**. Nach Import/Export werden Dateien wieder eingelesen, verändert und neu gespeichert. Vorhandene Exportdateien und geöffnete Dateien sind geschützt; externe Änderungen bleiben erhalten. Die Prüfung umfasst direkte PDF-Vorschau in Findobe, Rasterabschluss im Hintergrund, Entwurfssicherung auf der Festplatte, Wiederherstellung, kleine/gezielte Leseantworten, Inline-Änderungen und Annahme eines Vorschlags.
- Der native Launcher öffnet eine eigene Instanz, wartet auf deren Verbindungsdatei und setzt ihren Manifestpfad ausdrücklich. Der Test fordert eine leere Instanz und schließt nach Erfolg ausschließlich seine gespeicherten Test-Tabs. Ergebnisse des erfolgreichen Durchlaufs: `test-results/native-documents-1791929426466/summary.json`.
- `npx tauri build --bundles app`: optimierter Apple-Silicon-Build erfolgreich. Die aktuelle Anwendungsversion ist 0.4.0; die portable Dateischema-Version ist davon unabhängig `1`.
- Unabhängige Prüfung der erzeugten PDF-/Office-Dateien: Word- und ODT-Ausgaben mit dem gebündelten LibreOffice gerendert; PDF mit Poppler und pypdf geprüft. Ein Dokument mit **95 Tabellenzeilen** enthält in allen drei Ausgaben die erste und letzte Leistung sowie wiederholte Tabellenüberschriften auf jeder Seite. PDF: **11 Seiten**, DOCX: **10 Seiten**, ODT: **8 Seiten**. Alle Seiten wurden gerendert und in Übersichten geprüft; die einseitige Ausgabe zusätzlich in voller Ansicht. Die unterschiedlichen Satzprogramme umbrechen unterschiedlich.
- Der neue Dokument-Browser-Test meldet keine JavaScript-Fehler und keine externen Netzwerkanfragen. Original-HTML-Skripte, nicht unterstützte Linkziele und fremde Bildressourcen werden bereinigt. Office-Dateien bleiben lokal.
- `git diff --check`: bestanden.

### Während der Prüfung korrigiert

- ID-Normalisierung veränderte zunächst gemeinsam verwendete ProseMirror-Attributobjekte. Sie arbeitet jetzt auf einer tiefen Kopie; ein Regressionstest schützt gegen doppelte IDs und Veränderungen des Ausgangsdokuments.
- Fremdes HTML wird zuerst bereinigt und semantisch eingelesen; native JSON-Dokumente bleiben streng geprüft. Unpassende Agentenbausteine und ungültige Tabellen werden vollständig abgewiesen.
- Layout-/Titelentwürfe des Menschen werden bei Agentenänderungen erhalten und vor Speichern, Ausgabe und Agentenoperationen über dieselbe Transaktion übernommen.
- PDF.js wartet beim Display-Raster standardmäßig auf `requestAnimationFrame`. WKWebView kann diese Aufrufe in einem verdeckten Fenster aussetzen. Der Adapter der fest gebündelten Engine verwendet für native Rasteraufgaben Microtasks; Display-Intent und Annotationseinstellungen bleiben erhalten. Worker-Handler und Schriften sind lokal gebündelt, ohne gelockerte Dokument-Skriptregeln. Die Build-Prüfung verlangt den Adapter ausdrücklich.
- Ladefehler melden ihre konkrete Ursache an Agenten und stellen das zuvor geöffnete Dokument wieder her. `status` liefert bei laufenden Vorgängen Ladezustand und Fehler, ohne die Mutationswarteschlange zu blockieren.
- Entwürfe nutzen atomare Dateien im App-Datenordner statt der kleinen Web-Storage-Quote. Rückkehr und Speichern verwenden neue Arbeitskopien bzw. bestehende Dateischutzregeln.

### Grenzen der Nachweise

Kein CI-Lauf, kein Git-Push, kein öffentlicher Release und kein Windows-Laufzeittest. Native Prüfungen verwenden die tatsächliche Mac-WebView und Dateiverarbeitung; menschliche Tastatur-/Klickabläufe wurden mit Chromium automatisiert. CUA konnte wegen der als schreibbar konfigurierten OneDrive-Symlink-Wurzeln nicht initialisiert werden; eine zusätzliche native CUA-Sichtprüfung wird daher nicht behauptet.

Die Anwendung ist ein lokaler Dokumenteditor mit Agentenzugang, keine Cloud-Synchronisierung zwischen Rechnern. OCR, vollständige Rekonstruktion komplexer Word-/ODT-Layouts, Fußnoten/Felder und ursprüngliche Office-Änderungsverfolgung sind nicht enthalten. Kommentare/Vorschläge/Verlauf bleiben vollständig nur im Arbeitsformat. Für Details siehe `docs/DOCUMENT-CONTRACT.md`.

`npm audit` meldet drei moderate transitive Befunde im Node-CLI-Zweig von Mammoth (`argparse`/`sprintf-js`). Dieser Zweig ist nicht im ausgelieferten Browser-Bundle enthalten (durch Bundle-Eingaben/Lizenzliste geprüft). DOMPurify wurde einschließlich des Legacy-Bundles auf 3.4.17 aktualisiert. Keine Warnung wird durch einen Downgrade auf eine veraltete Mammoth-Version verdeckt.

### Lokale Installation und Abschluss

Die tatsächlich installierte `/Applications/FinDobe.app` ist 0.4.0. Die vorherige vollständige 0.3.0-App wurde als `dist/FinDobe-0.3.0-before-0.4.0-2026-10-14.app` gesichert. Das neue Bundle ist lokal ad-hoc signiert; `codesign --verify --deep --strict` besteht. Dies ist keine Apple Developer-ID-Signatur und keine Notarisierung für öffentliche Verteilung.

Der ausführbare Code des gebauten und installierten Bundles hat denselben SHA-256-Wert. Gegen die installierte App wurden erneut **alle 41 nativen Checks bestanden** (`test-results/native-documents-1791929749483/summary.json`). Der Test räumte seine gespeicherten Tabs auf. Anschließend wurde `examples/mensch-und-agent.findobe` ausschließlich über den nativen Agentenzugang erstellt und gespeichert; es ist in der installierten App zur gemeinsamen Weiterbearbeitung geöffnet. Die ursprünglichen fremden Checkout-Änderungen und Windows-Paketarbeiten wurden erhalten; es gab keinen Commit oder Push.

## Public repository and Pages preparation — 14.10.2026

- Editor bundles regenerated; `npm test`: 8 Rust tests and 13 Node tests passed.
- All nine existing browser smokes passed: editor, preview, markdown, usability, tabs, pdf, review-fixes, pdf-cache, document. Desktop/native boundaries remain simulated in browser checks.
- Static website checked in Chromium at 1440, 390, and 320 px in light and dark mode: self-hosted font and images loaded, no horizontal page overflow, no italic styles, one H1, no page errors or failed resource responses. Format-limit disclosure opened successfully. Desktop/mobile screenshots visually reviewed.
- Repository history scanned for common credential prefixes and private-key markers: no matches. This is a targeted pattern scan, not a guarantee that all private information or credentials are absent. Local coordinator files, test artifacts, and installers are excluded from Git. Current documentation no longer includes developer-specific home paths or client folder names.
- MIT license, package metadata, third-party license notices, contributor guidance, and private security reporting instructions added. Production npm audit: no high/critical findings; three moderate Mammoth CLI dependency-chain advisories documented in SECURITY.md.
- Pages publishes only `site/`; relative stylesheet, image, and font URLs support a project subpath. Existing app UI remains a desktop application. No public 0.4.0 desktop binary, signing/notarization, or Windows runtime validation is claimed.
