'use strict';
// Only paths from the Rust queue are consumed, never paths in an arbitrary event payload.
window.FinDobeFileOpen = async function ({listen, takeNext, isBusy, open, reportError}) {
  let running = false, requested = false, retry = null;
  async function drain() {
    requested = true;
    if (running) return;
    running = true;
    try {
      while (requested) {
        requested = false;
        if (isBusy()) {
          if (retry === null) retry = setTimeout(() => { retry = null; void drain(); }, 150);
          return;
        }
        const paths = await takeNext();
        if (!paths) continue;
        requested = true;
        if (paths.length !== 1) {
          reportError('Bitte eine einzelne Datei öffnen. Weitere Dateien kannst du anschließend öffnen.');
          continue;
        }
        await open(paths[0]);
      }
    } catch (error) {
      requested = false;
      reportError('Dateiübergabe fehlgeschlagen: ' + error);
    } finally {
      running = false;
    }
  }
  await listen('files-pending', () => { void drain(); });
  await drain();
};
