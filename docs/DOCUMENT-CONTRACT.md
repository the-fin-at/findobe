# Gemeinsame Dokumente in FinDobe

Menschen bearbeiten das Dokument im visuellen Editor. Agenten verwenden denselben laufenden Editor über einen authentifizierten lokalen HTTP-Zugang. Gezielte Änderungen passieren als atomare ProseMirror-Transaktionen und teilen den Rückgängig-Verlauf. Es gibt keine zweite HTML- oder JSON-Datei, die hinter dem Editor überschrieben wird.

## Arbeitsdatei

`.findobe` ist eine offene, selbstständige UTF-8-JSON-Datei. Das Format hat den Namen `findobe` und die Schema-Version `1`. Die Anwendungsversion ist unabhängig davon. Die Datei enthält:

- `format`, `version`, `revision`;
- `document`: den validierten Dokumentbaum mit stabilen Baustein-IDs;
- Dokumentattribute `title`, `layout`, `comments`, `proposals`;
- `history`: maximal 500 protokollierte Änderungen mit Autor, Revision, Zeit und Beschreibung.

Bilder sind eingebettete Daten-URLs. Die Arbeitsdatei benötigt keinen Ressourcenordner. Unbekannte Schema-Versionen werden abgewiesen. Fremde Office-Dateien werden beim Speichern der gemeinsamen Bearbeitung in eine neue `.findobe`-Arbeitsdatei überführt; das Original bleibt erhalten.

Absätze, Überschriften, Listen, Zitate, Code, Links, Bilder, Tabellen mit verbundenen Zellen und Textformatierungen sind bearbeitbar. Kopf-/Fußzeilen, A4/Letter, Ausrichtung, Rand und Seitenzahlen bestimmen die Ausgabe. Die Schreibansicht ist ein durchgehender Dokumentfluss; die tatsächlichen paginierten Seiten sieht man in **PDF-Vorschau**, in einem normalen Findobe-Tab.

## Agentenzugang

Die App bindet einen zufälligen Port ausschließlich an `127.0.0.1`. Eine lokale Verbindungsdatei enthält Port und zufälligen Bearer-Token. Unter macOS ist sie nur für den Benutzer lesbar (`0600`). Browser-Anfragen mit Origin und nicht authentifizierte Anfragen werden abgewiesen. Anfragen werden in der Oberfläche nacheinander verarbeitet; die Oberfläche und native Dateioperationen bestimmen den tatsächlichen Zustand.

```sh
node scripts/findobe-agent.mjs describe
node scripts/findobe-agent.mjs list
node scripts/findobe-agent.mjs read DOCUMENT_ID
node scripts/findobe-agent.mjs --json /absolute/path/request.json
node scripts/findobe-agent.mjs --stdin < /absolute/path/request.json
```

`FINDOBE_AGENT_MANIFEST` wählt bei mehreren App-Instanzen die gewünschte Verbindungsdatei. Ihr Pfad steht unter **Agentenzugang**. Das Werkzeug gibt den Token nicht aus. Die CLI benötigt Node mit `fetch` (Node 20 oder neuer).

Methoden:

| Methode | Wirkung |
| --- | --- |
| `describe`, `list`, `status` | Funktionen, geöffnete Dokumente bzw. Ladezustand und Fehler abfragen |
| `drafts`, `recover` | Gesicherte Entwürfe auflisten bzw. über `key` als Arbeitskopie wiederherstellen |
| `new`, `open` | Neues Arbeitsdokument bzw. lokale Datei öffnen |
| `convert` | HTML, Markdown, Text oder PDF in ein neues gemeinsames Dokument überführen |
| `read` | Inhalt, Revision und Bausteine lesen; `summary: true` reduziert die Antwort, `target: ID` liest nur einen Baustein |
| `apply`, `propose` | Änderungen direkt anwenden bzw. als prüfbaren Vorschlag hinterlassen |
| `comment`, `accept` | Baustein kommentieren bzw. bestehenden Vorschlag übernehmen |
| `save` | Arbeitsdatei speichern; optional absoluter `path` |
| `export`, `preview` | Datei ausgeben bzw. PDF-Vorschau in Findobe öffnen |
| `close` | Tab schließen; ungespeicherte Änderungen fragen den Menschen |

Ein `documentId` adressiert auch einen inaktiven Tab. Ohne Kennung wird das aktive Dokument verwendet. Legacy-Dateien benötigen zuerst `convert`. Ein Dialog oder eine laufende Dateioperation kann einen Aufruf mit „beschäftigt“ abweisen.

```json
{
  "method": "apply",
  "documentId": 1,
  "expectedRevision": 12,
  "author": "Rechercheagent",
  "summary": "Leistungsbeschreibung präzisiert",
  "operations": [
    {"type": "setText", "target": "ID-DES-ABSATZES", "text": "Die neue Leistungsbeschreibung."}
  ]
}
```

Operationen: `setMetadata` (nur `title` und `layout` unter `attrs`), `setText`, `replaceText`, `replace`, `insertBefore`, `insertAfter`, `append`, `delete`. `replace` und die Einfügeoperationen erhalten einen validen `node`. `replaceText` erhält zusätzlich `from`, `to`, `text`; die Grenzen sind UTF-16-Positionen innerhalb des Textbausteins. Es erhält die übrigen Textformatierungen. `setText` ersetzt den gesamten Absatzinhalt durch unformatierten Text und erhält dessen Bausteinattribute.

Jede Änderung benötigt die gelesene `expectedRevision`. Alternativ muss **jede** Operation einen `target` und dessen vollständigen, unveränderten JSON-Baustein als `expected` enthalten. Dann bleiben Änderungen an anderen Stellen zulässig. Fehlerhafte oder veraltete Batches ändern keinen Teil des Dokuments. Vorschläge prüfen beim Übernehmen erneut ihre Voraussetzungen. Nach einem Verbindungs-Timeout immer zuerst den Zustand lesen: eine verspätete Antwort bedeutet nicht zwangsläufig, dass die Operation nicht ausgeführt wurde.

`comment` erhält `target`, `text`, optional `author`. `propose` erhält dieselben Änderungsoperationen wie `apply`, zusätzlich optional `reason`. `accept` erhält `proposalId`. `export` erhält `format` und optional einen absoluten `path`; zulässig sind `findobe`, `docx`, `odt`, `html`, `md`, `txt`, `pdf`. Explizite Agentenpfade überschreiben keine bestehenden Dateien. Geöffnete Dateien sind auch vor Export geschützt. Normales Speichern schützt gegen externe Dateiänderungen per Fingerprint; dies ist keine Betriebssystem-Dateisperre.

## Dateiformate und Grenzen

| Format | Import in gemeinsame Bearbeitung | Export |
| --- | --- | --- |
| Findobe | Dokument, IDs, Layout, Kommentare, Vorschläge, Verlauf | Arbeitsformat, verlustfrei |
| DOCX | Text, Überschriften, Listen, Tabellen, Bilder, grundlegende Textformatierung | Bearbeitbares Word-Dokument mit Seitenlayout |
| ODT | Text, Überschriften, Listen, Tabellen, Bilder, grundlegende Textformatierung | OpenDocument-Paket mit Seitenlayout |
| HTML | Bereinigter semantischer Inhalt, lokale Bilder im Dokumentordner | Selbstständiges Dokument mit eingebetteten Bildern |
| Markdown | GFM-Inhalt einschließlich Tabellen und lokaler Bilder | GFM; nicht alle Rich-Text-Eigenschaften darstellbar |
| Text | Unformatierter Text | Unformatierter Text |
| PDF | Textschicht; neues Dokument, keine Layoutrekonstruktion | Direkte PDF mit eingebetteten Schriften, Tabellenumbruch und Seitenzahlen |

Die ursprünglichen quelltreuen HTML-/Markdown-Editoren und die PDF-Textkorrektur bleiben verfügbar. Die Konvertierung ist eine ausdrücklich gewählte Kopie. Gescannte PDFs benötigen OCR und können nicht in bearbeitbaren Text umgewandelt werden. Änderungen in der PDF-Textkorrektur werden vor einer Konvertierung berücksichtigt.

Kommentare, Vorschläge und Verlauf bleiben nur in `.findobe` vollständig erhalten. Office-Import ist keine vollständige Rekonstruktion von Word/LibreOffice: Fußnoten, Felder, schwebende Objekte, komplexe Stile, bestehende Änderungsverfolgung und Seitensatz können abweichen. Die App meldet dies beim Import. PDF, DOCX und ODT nutzen unterschiedliche Satzprogramme und sind nicht pixelidentisch. PDF verwendet Albert Sans / Geist Mono; DOCX und ODT haben Arial / Courier New als portable Standards. Die App-Oberfläche und die Ausgaben stehen aufrecht.

Dateien bleiben auf 30 MB begrenzt. Office-Pakete werden zusätzlich auf höchstens 2.000 Einträge und 60 MB entpackten Inhalt geprüft. Das Dokumentmodell begrenzt Tiefe, Bausteinzahl und Metadaten. Eingebettete Rasterbilder sind zulässig; Dokument-Skripte, fremde Webressourcen und externe Office-Dateizugriffe werden nicht ausgeführt bzw. geladen.

Entwürfe der gemeinsamen Bearbeitung werden verzögert und atomar im lokalen App-Datenordner gesichert, außerhalb der geöffneten Datei. Die Sicherung hat das gleiche Dateigrößenlimit und ist nicht auf Web-Storage-Quoten angewiesen. Wiederherstellen öffnet eine neue Arbeitskopie. Erfolgreiches Speichern und ausdrücklich bestätigtes Verwerfen entfernen den zugehörigen Entwurf. Ein abruptes Ende innerhalb des kurzen Sicherungsintervalls kann die letzten Eingaben verlieren; reguläre Dateisicherungen bleiben notwendig.

Die PDF-Engine verwendet im nativen Editor den lokal gebündelten PDF.js-Handler mit dessen Loopback-Transport. Dadurch funktioniert sie unter dem restriktiven Release-CSP auch ohne Blob-Skriptimporte. Der Adapter der gebündelten PDF.js-Version plant native Rasteraufgaben ohne `requestAnimationFrame`, damit auch ein verdecktes App-Fenster fertig laden kann; der Display-Modus und die Annotationseinstellungen bleiben erhalten. Die Rasterpuffer behalten ihr bisheriges Budget; PDF-Verarbeitung läuft dabei im WebView-Kontext. Auf unterstützten macOS-Versionen ist das Drosseln des Hauptfensters im Hintergrund abgeschaltet, damit Agentenaufrufe weiterarbeiten können. Ladefristen lösen hängen gebliebene Öffnungen mit einem Fehler auf.

Die Zusammenarbeit verbindet einen lokalen menschlichen Editor mit mehreren Agenten. Es gibt keine Cloud-Synchronisierung zwischen mehreren Rechnern, keine eingebauten Modell-API-Schlüssel und keine automatisch gestarteten KI-Aufträge.

## Prüfen

```sh
npm test
npm run test:browser
# Eine aktuelle, laufende, leere Findobe-Testinstanz vorausgesetzt; erzeugt nur Testdateien:
npm run test:native-documents
# Auf macOS: frische Testinstanz des gebauten Bundles automatisch starten
npm run test:native-app
npx tauri build --bundles app
```

Der native Test verwendet den echten lokalen Agentenzugang und echte Rust-Dateioperationen. Browser-Tests prüfen menschliche Eingaben, gemeinsame Historie, Konflikte, atomare Batches, Kommentare/Vorschläge, Wiederherstellung und Formatdurchläufe. Generierte Office-Dateien werden zusätzlich mit dem gebündelten LibreOffice gerendert; PDF-Inhalte und Seiten werden unabhängig geprüft. Windows-Laufzeitverhalten ist separat zu testen.

Bei mehreren laufenden Instanzen für native Tests den Manifestpfad der leeren Testinstanz ausdrücklich setzen. Der Test bricht ab, wenn sie bereits Dokumente enthält, und schließt nach erfolgreichem Lauf ausschließlich seine gespeicherten Test-Tabs.
