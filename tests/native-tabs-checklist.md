# Native Tabs-Prüfung (macOS)

Die Browser-Tests ersetzen diese Prüfung nicht: Sie simulieren die Tauri-Aufrufe, nicht Cocoa-Menüs oder Finder-Ereignisse.

1. Zwei wegwerfbare Markdown-Dateien mit verschiedenen Namen anlegen. FinDobe vollständig beenden und die erste im Finder doppelklicken. Es muss genau ein Tab erscheinen.
2. Eine Zeile ergänzen, nicht speichern. Zweite Datei im Finder doppelklicken. Zwei Tabs, erster mit Änderungspunkt, zweiter ohne. Zurückwechseln: Eingabe bleibt erhalten.
3. Auch im zweiten Tab tippen. ⌘W: Rückfrage nennt nur die zweite Datei. Abbrechen erhält beide Tabs. Erneut schließen und speichern: Nur die zweite Datei wird auf Disk geändert, erster Tab bleibt ungespeichert.
4. **⌘Q und FinDobe → FinDobe beenden** getrennt prüfen: Die Rückfrage muss die noch geänderte erste Datei nennen. Abbrechen erhält Fenster und Eingabe. Verwerfen beendet die App, ohne die erste Datei zu überschreiben.
5. Fenster-Schließen bei mehreren geänderten Tabs: Erst Verwerfen, dann Abbrechen. Alle Tabs und auch die erste Eingabe bleiben erhalten.
6. Eine HTML-Datei hinzufügen, Vorschau auswählen, zu Markdown und zurück wechseln: Gestaltung, Eingabe und gewählte Ansicht bleiben erhalten.

Regression am 17.09.2026: Der vordefinierte Cocoa-Menüpunkt `Quit` rief `terminate:` direkt auf und umging Tauris `ExitRequested`. Mit einer geänderten Datei sowohl über ⌘Q als auch den Menüpunkt reproduziert. Der eigene Menüpunkt sendet stattdessen `request-close` an die zentrale Tabs-Rückfrage. Dafür gibt es keinen gleichwertigen reinen Node-/Rust-Unit-Test: Der Test muss das native Menü auslösen.

Keine Zusage für Absturz, erzwungenes Beenden oder Betriebssystem-Shutdown; Entwurfs-Wiederherstellung ist ein separates Feature.
