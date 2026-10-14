# FinDobe 0.3.0 – Windows-MSI

Stand: 18.09.2026. **Pilotpaket: unsigniert und noch nicht auf Windows installiert oder ausgeführt.** Die Installer-Datenbank, Installationsregeln und extrahierten Dateien wurden lokal geprüft. Das ersetzt keinen Windows-Pilottest und keine Freigabe für einen breiten Rollout.

## Paket und Voraussetzungen

- `FinDobe-0.3.0-x64.msi`: Windows x64, geräteweite Installation im System-/Administratorkontext nach `C:\Program Files\FinDobe` (bei Standard-Systempfaden).
- Startmenüeintrag für alle Benutzer; kein automatischer App-Start, kein Autostart, keine Übernahme von Dateizuordnungen.
- Enthält Dokument-Tabs für HTML, PDF und Markdown mit getrennten Änderungen und Rückgängig-Verläufen, PDF-Textkorrektur, Markdown-Schreiben/Quelltext/Vorschau, WebView2Loader sowie Bibliothekslizenzen. Keine automatische Entwurfssicherung nach Absturz oder Neustart.
- **Microsoft Edge WebView2 Evergreen Runtime muss vorher geräteweit installiert sein.** Der MSI lädt nichts nach. Er prüft den Maschinen-Registrywert `pv` in der 32-Bit-Ansicht unter `HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}`; leer oder `0.0.0.0` wird abgewiesen. Ein vorhandener Edge-Browser allein ist kein Ersatz. [Microsoft: WebView2 verteilen und erkennen](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution).
- Nur x64-Geräte zuweisen. Kein natives ARM64-/x86-Paket. Die Installationsbedingung prüft 64-Bit-Windows, aber nicht die Prozessorarchitektur einer emulierenden ARM64-Umgebung. Empfohlener erster Pilot: verwaltetes Windows-11-x64-Gerät.

Das Paket verwendet `ALLUSERS=1` für den Maschinenkontext. Standardbenutzer benötigen zur manuellen Installation eine Erhöhung; ein Management-Agent kann die Installation im Systemkontext ausführen. [Microsoft: ALLUSERS](https://learn.microsoft.com/en-us/windows/win32/msi/allusers).

## Installation ohne Benutzerinteraktion

Vorher FinDobe schließen und offene Dokumente speichern. Das Paket beendet keine Prozesse gewaltsam.

Die folgenden Befehle sind für `cmd.exe` beziehungsweise entsprechende Management-Befehlsfelder geschrieben; in PowerShell Umgebungsvariablen entsprechend anpassen.

```bat
msiexec.exe /i "FinDobe-0.3.0-x64.msi" /qn /norestart /L*v "%ProgramData%\FinDobe-install.log"
```

Deinstallation:

```bat
msiexec.exe /x {908EC58D-F8B1-5C7A-9B33-F0BB1D1AF593} /qn /norestart /L*v "%ProgramData%\FinDobe-uninstall.log"
```

`/qn` unterdrückt die Oberfläche, `/norestart` automatische Neustarts; `/L*v` schreibt ein ausführliches Log. [Microsoft: msiexec](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/msiexec).

## Device Management / Intune

1. WebView2 Evergreen Runtime geräteweit als Voraussetzung ausrollen und dessen erfolgreiche Installation erkennen.
2. MSI im Gerätekontext einer kleinen x64-Pilotgruppe zuweisen.
3. Erkennung über MSI-ProductCode: `{908EC58D-F8B1-5C7A-9B33-F0BB1D1AF593}`; Version `0.3.0`.
4. Alternativ den 64-Bit-Registrywert `HKLM\Software\THE-FIN\FinDobe`, Name `Version`, Wert `0.3.0` prüfen. Nicht die 32-Bit-Registryansicht verwenden.
5. Installationsstatus und Logs prüfen; dann als Standardbenutzer starten und den untenstehenden Funktionstest durchführen.

In Intune ist eine Windows-Line-of-business-App mit MSI möglich. Wer WebView2 als App-Abhängigkeit verwalten möchte, kann FinDobe stattdessen als Win32-App verpacken. Ein `.intunewin`-Paket und eine Intune-Konfiguration sind **nicht** Teil dieser Lieferung; diese Bereitstellungswege wurden hier nicht praktisch getestet. [Microsoft: Windows-LOB-App hinzufügen](https://learn.microsoft.com/en-us/intune/app-management/deployment/add-lob-windows), [Win32-App hinzufügen](https://learn.microsoft.com/en-us/mem/intune-service/apps/apps-win32-add).

## Updates und Signierung

- Dauerhafte UpgradeCode der x64-Produktlinie: `{BA217E1B-A2DB-489B-AE18-30D30C93D851}`.
- Upgrade von `0.2.0` sowie `0.1.0` (ProductCode `{30304E6B-5FF7-5DEA-B68A-022D2EBBFF32}`) ist über den normalen Installationsbefehl vorgesehen. Nicht vorher separat deinstallieren: Das neue MSI enthält die Entfernung der alten Version innerhalb seiner Installationstransaktion. Neue ProductCode und PackageCode sowie unveränderte Komponenten-GUIDs werden gegen das alte MSI statisch geprüft.
- Jede neue auszurollende Binärversion benötigt eine höhere dreiteilige Produktversion und damit eine neue ProductCode. **Nicht geänderte Dateien unter derselben Version verteilen.** Die Build-Routine leitet die ProductCode aus der Version ab; sie erzwingt selbst keine Release-Historie.
- Das MSI enthält Regeln zur Entfernung älterer MSI-Versionen innerhalb der Installationstransaktion und zur Sperre von Downgrades. Tatsächliches Upgrade/Rollback muss auf Windows geprüft werden.
- Frühere portable ZIP-Kopien werden nicht entfernt. Bestehende NSIS-Installationen werden nicht automatisch migriert.
- MSI und Programm sind unsigniert. Vor breiter Verteilung mit einem geeigneten Organisationszertifikat signieren und gegen die geltenden AppLocker-/WDAC-/Signaturrichtlinien prüfen. Nach Signierung ändern sich Prüfsummen; Paketmanifest aktualisieren. Programm vor der Paketierung signieren, MSI danach.
- Nutzerdateien gehören nicht zum Installationspaket; die Deinstallationsregeln entfernen nur installierte App-Dateien, Startmenüeintrag und Produkt-Registrywert. Dokumente trotzdem wie üblich sichern.

## Pilot-Abnahme auf Windows

- Frische Installation im Systemkontext mit WebView2; ohne Runtime nachvollziehbarer Abbruch im Log.
- Start als Standardbenutzer, HTML, PDF und Markdown öffnen, vorhandenen PDF-Text korrigieren und nach Speichern erneut öffnen, Schreiben/Quelltext/Vorschau wechseln, speichern und PDF über den Windows-Druckdialog erstellen.
- Zwei Dateien öffnen und beide bearbeiten: getrennte Änderungspunkte, Tabwechsel ohne Textverlust, Rückgängig nur im aktuellen Tab. Schließen sowie Beenden mit Speichern/Verwerfen/Abbrechen prüfen. Nach abgebrochenem Beenden müssen alle offenen Änderungen erhalten bleiben.
- Standardbenutzer nach Ab-/Anmeldung: App weiterhin verfügbar.
- Reparatur sowie Deinstallation; Testdokumente bleiben erhalten.
- MSI 0.2.0 installieren, anschließend 0.3.0 im Systemkontext darüber installieren. Nur 0.3.0 darf als installiert gemeldet werden; anschließend Downgrade auf 0.2.0 und Verhalten bei Installationsfehler testen.
- Signatur-/Endpunktschutz-Richtlinien und tatsächliche Management-Zuweisung prüfen.

## Erneut bauen

Zuerst `npx tauri build --target x86_64-pc-windows-gnu --no-bundle` ausführen und `findobe.exe` sowie `WebView2Loader.dll` aus `src-tauri/target/x86_64-pc-windows-gnu/release/` nach `dist/FinDobe-Windows-x64/` kopieren; die EXE dort `FinDobe.exe` nennen. Dieser Cross-Build benötigt das Rust-Ziel `x86_64-pc-windows-gnu` und MinGW-w64.

`npm run build:msi` verwendet diesen Windows-GNU-Release-Build und die passende Kopie in `dist/FinDobe-Windows-x64`. EXE-Übereinstimmung wird vorab geprüft. Weitere Voraussetzungen: Node.js und `wixl`, `msibuild`, `msiinfo`, `msiextract` aus msitools (hier auf macOS mit msitools 0.106 geprüft).

Die Build-Routine erstellt ein eingebettetes MSI, prüft Installationstabellen und alle vier extrahierten Nutzdateien anhand ihrer SHA-256-Werte und schreibt `dist/FinDobe-0.3.0-x64.manifest.json`. Die Prüfungen inklusive Vergleich mit dem alten Paket sind wiederholbar mit `node scripts/verify-msi.mjs dist/FinDobe-0.3.0-x64.msi dist/FinDobe-0.2.0-x64.msi`. Es erfolgt keine Windows-Installer-/ICE-Validierung. Die vorhandene GitHub-Actions-NSIS-Vorlage wurde nicht geändert oder gestartet.
