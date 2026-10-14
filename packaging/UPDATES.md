# FinDobe: Updates veröffentlichen und installieren

Stand 18.09.2026, neue Version 0.3.0 mit PDF-Textkorrektur.

## Was heute vorhanden ist

Die MSI-Pakete unterstützen Versions-Upgrades. FinDobe selbst prüft noch nicht auf Updates und lädt keine neue Version herunter. Ein Git-Push verteilt nichts an Clients. Die bestehende GitHub-Actions-Datei wird manuell gestartet und erzeugt Build-Artefakte (Windows derzeit NSIS), keine veröffentlichten MSI-Releases und keine automatische Client-Verteilung.

## Verwaltete Windows-Clients

1. Für jede Veröffentlichung eine höhere dreiteilige Version vergeben; diese in npm, Cargo, Tauri und sichtbarer Oberfläche gleich halten. Nicht ein bereits verteiltes Paket unter derselben Version austauschen.
2. Windows-Programm neu bauen, Programm signieren, MSI paketieren, MSI signieren. Die UpgradeCode bleibt gleich; die ProductCode ändert sich je Version. Danach Prüfsummen und Manifest aktualisieren.
3. Auf einem Pilotgerät sowohl Neuinstallation als auch Upgrade der vorigen MSI-Version testen. Öffnen, Bearbeiten, Speichern, erneutes Öffnen und Deinstallation prüfen. WebView2 muss geräteweit vorhanden sein.
4. Paket über die Geräteverwaltung verteilen. In Intune als Win32-App verpacken, Systemkontext und x64-Anforderung setzen, Versionserkennung und gegebenenfalls WebView2-Abhängigkeit hinterlegen. Die neue Version kann über Supersedence die alte ersetzen. Da das MSI das Upgrade übernimmt, keine separate Vorab-Deinstallation konfigurieren.
5. Zunächst Pilotgruppe, dann breitere Zuweisung. Vor Installation offene Dokumente speichern und FinDobe schließen; Prozesse nicht gewaltsam beenden. Installationsergebnis und Neustartbedarf auswerten.

Die aktuelle Lieferung enthält ein MSI, kein .intunewin-Paket und keine eingerichtete Intune-Zuweisung. Signierung und Windows-Pilottest sind noch offen.

## Manuelle Installation

FinDobe schließen, neues MSI starten und die Administratorabfrage bestätigen. Alternativ im erhöhten cmd.exe:

```bat
msiexec.exe /i "FinDobe-0.3.0-x64.msi" /qn /norestart /L*v "%ProgramData%\FinDobe-install.log"
```

Bei einer bisherigen MSI-Installation ist keine separate Deinstallation nötig. Portable ZIP-Kopien oder NSIS-Installationen werden nicht automatisch entfernt beziehungsweise migriert. Dokumente gehören nicht zum Installationspaket. Die aktuellen Kennungen für die Erkennung stehen in `windows/DEPLOYMENT.md` und im Paketmanifest.

## Später: Update-Funktion in der App

Dafür muss einmalig eine Version mit Tauri-Updater installiert werden. Danach fragt die App eine HTTPS-Adresse mit Versionsinformationen ab und kann ein signiertes Update herunterladen und installieren. Die Updater-Signatur mit eigenem sicher verwahrten privaten Schlüssel ist zusätzlich zur Betriebssystem-Signierung zu behandeln. Erforderlich sind Update-Hosting, Veröffentlichungsablauf, Nutzerhinweis, Umgang mit offenen Dokumenten und ein getesteter Installations-/Neustartablauf. Administratorrechte bei geräteweiter Installation werden dadurch nicht umgangen.

Für verwaltete Firmenrechner bietet sich zentrale Verteilung an; für selbstverwaltete Clients kann ein App-Updater ergänzt werden. Beide Wege sollten sich auf demselben Gerät nicht unkoordiniert gegenseitig aktualisieren.

## Möglicher automatisierter Release-Ablauf

Versionsänderung und geprüfter Commit → Release-Tag → CI baut Mac und Windows → Tests und Signierung → Veröffentlichung der unveränderlichen Pakete samt Prüfsummen → Pilotfreigabe → Zuweisung über Geräteverwaltung oder Veröffentlichung im Update-Kanal.

Dieser Ablauf ist ein Vorschlag; er wurde mit dieser Lieferung nicht eingerichtet. Auch ein Release-Tag löst im aktuellen Workflow noch keine Veröffentlichung aus.

## Quellen

- [Microsoft: Intune Win32 Supersedence](https://learn.microsoft.com/en-us/intune/app-management/deployment/configure-win32-supersedence)
- [Microsoft: msiexec](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/msiexec)
- [Tauri: Updater und Signaturen](https://v2.tauri.app/plugin/updater/)
