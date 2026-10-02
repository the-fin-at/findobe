use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, VecDeque},
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

const MAX_BYTES: u64 = 30 * 1024 * 1024;
type Result<T> = std::result::Result<T, String>;

#[derive(Clone)]
struct Document {
    path: PathBuf,
    hash: Vec<u8>,
}
#[derive(Default)]
struct Store {
    next_id: u64,
    documents: HashMap<u64, Document>,
    print_html: Option<String>,
    allow_exit: bool,
    pending_files: VecDeque<Vec<String>>,
}
#[derive(Serialize)]
struct Opened {
    id: u64,
    name: String,
    path: String,
    text: String,
    encoding: &'static str,
}
#[derive(Serialize)]
struct Saved {
    name: String,
    path: String,
}
fn error(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn fingerprint(bytes: &[u8]) -> Vec<u8> {
    Sha256::digest(bytes).to_vec()
}
fn check_save_target(store: &Store, id: u64, destination: &Path) -> Result<()> {
    if store
        .documents
        .iter()
        .any(|(other_id, doc)| *other_id != id && doc.path == destination)
    {
        return Err("Diese Datei ist bereits in einem anderen Tab geöffnet. Bitte einen anderen Dateinamen wählen oder den anderen Tab zuerst schließen.".into());
    }
    Ok(())
}
fn main_only(window: &WebviewWindow) -> Result<()> {
    if window.label() == "main" {
        Ok(())
    } else {
        Err("Dieser Aufruf ist nur im Editor möglich.".into())
    }
}
fn supported(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase()
            .as_str(),
        "html" | "htm" | "md" | "markdown" | "txt" | "pdf"
    )
}
fn is_pdf(path: &Path) -> bool {
    path.extension().and_then(|s| s.to_str()).is_some_and(|s| s.eq_ignore_ascii_case("pdf"))
}
fn validate_pdf(bytes: &[u8]) -> Result<()> {
    if !bytes.iter().take(1024).copied().collect::<Vec<_>>().windows(5).any(|w| w == b"%PDF-") {
        return Err("Das ist keine PDF-Datei.".into());
    }
    Ok(())
}
fn save_bytes(path: &Path, content: String) -> Result<Vec<u8>> {
    let bytes = if is_pdf(path) {
        if content.len() as u64 > (MAX_BYTES + 2) / 3 * 4 {
            return Err("Das Dokument ist größer als 30 MB.".into());
        }
        let bytes = STANDARD.decode(content).map_err(error)?;
        validate_pdf(&bytes)?;
        bytes
    } else { content.into_bytes() };
    if bytes.len() as u64 > MAX_BYTES { return Err("Das Dokument ist größer als 30 MB.".into()); }
    Ok(bytes)
}
fn read_document(path: &Path) -> Result<(PathBuf, String, Vec<u8>)> {
    if !supported(path) {
        return Err("Bitte eine HTML-, PDF-, Markdown- oder Textdatei öffnen.".into());
    }
    let path = path.canonicalize().map_err(error)?;
    let meta = fs::metadata(&path).map_err(error)?;
    if !meta.is_file() || meta.len() > MAX_BYTES {
        return Err("Bitte eine Datei mit höchstens 30 MB auswählen.".into());
    }
    let bytes = fs::read(&path).map_err(error)?;
    let text = if is_pdf(&path) {
        validate_pdf(&bytes)?;
        STANDARD.encode(&bytes)
    } else {
        String::from_utf8(bytes.clone()).map_err(|_| {
            "Die Datei ist nicht UTF-8-kodiert. Bitte zuerst als UTF-8 speichern.".to_string()
        })?
    };
    Ok((path, text, fingerprint(&bytes)))
}
fn register(path: &Path, state: &Mutex<Store>) -> Result<Opened> {
    let (path, text, hash) = read_document(path)?;
    let mut store = state.lock().map_err(error)?;
    store.next_id += 1;
    let id = store.next_id;
    store.documents.insert(
        id,
        Document {
            path: path.clone(),
            hash,
        },
    );
    Ok(Opened {
        id,
        name: path.file_name().unwrap().to_string_lossy().into(),
        path: path.to_string_lossy().into(),
        text,
        encoding: if is_pdf(&path) { "base64" } else { "utf8" },
    })
}
fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().ok_or("Ungültiger Speicherort.")?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(error)?;
    if let Ok(meta) = fs::metadata(path) {
        temporary
            .as_file()
            .set_permissions(meta.permissions())
            .map_err(error)?;
    }
    temporary.write_all(bytes).map_err(error)?;
    temporary.as_file().sync_all().map_err(error)?;
    temporary.persist(path).map_err(error)?;
    Ok(())
}
fn write_document(document: &mut Document, bytes: &[u8]) -> Result<()> {
    let current = fs::read(&document.path).map_err(error)?;
    if fingerprint(&current) != document.hash {
        return Err("Die Datei wurde außerhalb von FinDobe verändert. Verwende „Speichern unter…“, um deine Änderungen separat zu sichern, oder öffne die aktuelle Datei erneut.".into());
    }
    atomic_write(&document.path, bytes)?;
    document.hash = fingerprint(bytes);
    Ok(())
}

#[tauri::command]
async fn open_document(
    window: WebviewWindow,
    state: State<'_, Mutex<Store>>,
) -> Result<Option<Opened>> {
    main_only(&window)?;
    let picked = window
        .app_handle()
        .dialog()
        .file()
        .set_title("Dokument öffnen")
        .add_filter(
            "HTML, PDF, Markdown und Text",
            &["html", "htm", "pdf", "md", "markdown", "txt"],
        )
        .set_parent(&window)
        .blocking_pick_file();
    match picked {
        Some(p) => Ok(Some(register(&p.into_path().map_err(error)?, &state)?)),
        None => Ok(None),
    }
}
#[tauri::command]
async fn open_path(
    window: WebviewWindow,
    path: String,
    state: State<'_, Mutex<Store>>,
) -> Result<Opened> {
    main_only(&window)?;
    register(Path::new(&path), &state)
}
#[tauri::command]
fn release_document(window: WebviewWindow, id: u64, state: State<'_, Mutex<Store>>) -> Result<()> {
    main_only(&window)?;
    state.lock().map_err(error)?.documents.remove(&id);
    Ok(())
}
// Keep Finder requests until the frontend listener is ready (including cold launch).
#[tauri::command]
fn take_pending_files(
    window: WebviewWindow,
    state: State<'_, Mutex<Store>>,
) -> Result<Option<Vec<String>>> {
    main_only(&window)?;
    Ok(state.lock().map_err(error)?.pending_files.pop_front())
}

#[cfg(target_os = "macos")]
fn local_open_paths(urls: Vec<tauri::Url>) -> Vec<String> {
    urls.into_iter()
        .filter_map(|url| url.to_file_path().ok())
        .filter_map(|path| path.into_os_string().into_string().ok())
        .collect()
}
#[tauri::command]
async fn save_document(
    window: WebviewWindow,
    id: u64,
    content: String,
    save_as: bool,
    state: State<'_, Mutex<Store>>,
) -> Result<Option<Saved>> {
    main_only(&window)?;
    let doc = state
        .lock()
        .map_err(error)?
        .documents
        .get(&id)
        .cloned()
        .ok_or("Bitte die Datei erneut öffnen.")?;
    let bytes = save_bytes(&doc.path, content)?;
    let destination = if save_as {
        let extension = doc
            .path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("md");
        let chosen = window
            .app_handle()
            .dialog()
            .file()
            .set_title("Dokument speichern unter")
            .add_filter("Dokument", &[extension])
            .set_parent(&window)
            .set_directory(doc.path.parent().unwrap())
            .set_file_name(doc.path.file_name().unwrap().to_string_lossy())
            .blocking_save_file();
        let Some(chosen) = chosen else {
            return Ok(None);
        };
        let mut path = chosen.into_path().map_err(error)?;
        if path.extension().is_none() {
            path.set_extension(extension);
        }
        if path
            .extension()
            .and_then(|s| s.to_str())
            .map(str::to_lowercase)
            != Some(extension.to_lowercase())
        {
            return Err("Beim Speichern bleibt das Dateiformat erhalten. Für ein anderes Ausgabeformat nutze den PDF-Export.".into());
        }
        path.canonicalize().unwrap_or(path)
    } else {
        doc.path.clone()
    };
    let mut store = state.lock().map_err(error)?;
    check_save_target(&store, id, &destination)?;
    let document = store
        .documents
        .get_mut(&id)
        .ok_or("Bitte die Datei erneut öffnen.")?;
    if destination == document.path {
        write_document(document, &bytes)?;
    } else {
        atomic_write(&destination, &bytes)?;
        document.path = destination.clone();
        document.hash = fingerprint(&bytes);
    }
    Ok(Some(Saved {
        name: destination.file_name().unwrap().to_string_lossy().into(),
        path: destination.to_string_lossy().into(),
    }))
}
#[tauri::command]
async fn read_resource(
    window: WebviewWindow,
    id: u64,
    relative: String,
    state: State<'_, Mutex<Store>>,
) -> Result<String> {
    main_only(&window)?;
    let doc = state
        .lock()
        .map_err(error)?
        .documents
        .get(&id)
        .cloned()
        .ok_or("Kein Dokument geöffnet.")?;
    let parent = doc.path.parent().unwrap();
    let path = parent.join(relative).canonicalize().map_err(error)?;
    if !path.starts_with(parent) {
        return Err("Die Ressource liegt außerhalb des Dokumentordners.".into());
    }
    let mime = match path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "css" => "text/css",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        _ => return Err("Diese Ressource wird nicht geladen.".into()),
    };
    if fs::metadata(&path).map_err(error)?.len() > MAX_BYTES {
        return Err("Ressource zu groß.".into());
    }
    Ok(format!(
        "data:{};base64,{}",
        mime,
        STANDARD.encode(fs::read(path).map_err(error)?)
    ))
}
#[tauri::command]
async fn export_pdf(
    window: WebviewWindow,
    html: String,
    name: String,
    state: State<'_, Mutex<Store>>,
) -> Result<()> {
    main_only(&window)?;
    if html.len() as u64 > MAX_BYTES * 3 {
        return Err("Das Dokument ist zu groß für den PDF-Export.".into());
    }
    let app = window.app_handle();
    if let Some(existing) = app.get_webview_window("print") {
        existing.destroy().map_err(error)?;
    }
    state.lock().map_err(error)?.print_html = Some(html);
    WebviewWindowBuilder::new(app, "print", WebviewUrl::App("print.html".into()))
        .title(format!("{} — PDF exportieren", name))
        .inner_size(850.0, 950.0)
        .min_inner_size(600.0, 500.0)
        .build()
        .map_err(error)?;
    Ok(())
}
#[tauri::command]
fn print_content(window: WebviewWindow, state: State<'_, Mutex<Store>>) -> Result<String> {
    if window.label() != "print" {
        return Err("Kein Exportfenster.".into());
    }
    state
        .lock()
        .map_err(error)?
        .print_html
        .take()
        .ok_or("Kein Dokument zum Exportieren.".into())
}
#[tauri::command]
fn print_ready(window: WebviewWindow) -> Result<()> {
    if window.label() != "print" {
        return Err("Kein Exportfenster.".into());
    }
    window.print().map_err(error)
}
#[tauri::command]
fn close_editor(window: WebviewWindow) -> Result<()> {
    main_only(&window)?;
    window
        .state::<Mutex<Store>>()
        .lock()
        .map_err(error)?
        .allow_exit = true;
    window.app_handle().exit(0);
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .menu(|app| {
            let menu = tauri::menu::Menu::default(app)?;
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{MenuItem, PredefinedMenuItem, Submenu};
                // The predefined macOS Quit item calls NSApplication terminate:
                // directly, bypassing Tauri's cancellable ExitRequested event.
                let app_menu = Submenu::with_items(
                    app,
                    "FinDobe",
                    true,
                    &[
                        &PredefinedMenuItem::about(app, Some("Über FinDobe"), None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::services(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::hide(app, None)?,
                        &PredefinedMenuItem::hide_others(app, None)?,
                        &PredefinedMenuItem::separator(app)?,
                        &MenuItem::with_id(
                            app,
                            "findobe-quit",
                            "FinDobe beenden",
                            true,
                            Some("CmdOrCtrl+Q"),
                        )?,
                    ],
                )?;
                menu.remove_at(0)?;
                menu.insert(&app_menu, 0)?;
            }
            Ok(menu)
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "findobe-quit" {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                    let _ = window.emit("request-close", ());
                }
            }
        })
        .manage(Mutex::new(Store::default()))
        .invoke_handler(tauri::generate_handler![
            open_document,
            open_path,
            release_document,
            take_pending_files,
            save_document,
            read_resource,
            export_pdf,
            print_content,
            print_ready,
            close_editor
        ])
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.emit("request-close", ());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("FinDobe konnte nicht gestartet werden")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { ref urls } = event {
                let paths = local_open_paths(urls.clone());
                if !paths.is_empty() {
                    if let Ok(mut store) = app.state::<Mutex<Store>>().lock() {
                        store.pending_files.push_back(paths);
                    }
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                        let _ = window.emit("files-pending", ());
                    }
                }
            }
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                let allowed = app
                    .state::<Mutex<Store>>()
                    .lock()
                    .map(|s| s.allow_exit)
                    .unwrap_or(false);
                if !allowed {
                    if let Some(window) = app.get_webview_window("main") {
                        api.prevent_exit();
                        let _ = window.emit("request-close", ());
                    }
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn save_target_protects_other_open_tabs() {
        let mut store = Store::default();
        store.documents.insert(
            1,
            Document {
                path: PathBuf::from("/notes/a.md"),
                hash: vec![],
            },
        );
        store.documents.insert(
            2,
            Document {
                path: PathBuf::from("/notes/b.md"),
                hash: vec![],
            },
        );
        assert!(check_save_target(&store, 1, Path::new("/notes/a.md")).is_ok());
        assert!(check_save_target(&store, 1, Path::new("/notes/b.md")).is_err());
        assert!(check_save_target(&store, 1, Path::new("/notes/c.md")).is_ok());
        store.documents.remove(&2);
        assert!(check_save_target(&store, 1, Path::new("/notes/b.md")).is_ok());
    }
    #[test]
    #[cfg(target_os = "macos")]
    fn finder_paths_decode_unicode_and_ignore_remote_urls() {
        assert_eq!(
            local_open_paths(vec![
                tauri::Url::parse("file:///tmp/Gr%C3%BC%C3%9Fe%20%23%20Notiz.md").unwrap(),
                tauri::Url::parse("https://example.com/note.md").unwrap(),
            ]),
            vec!["/tmp/Grüße # Notiz.md"]
        );
    }
    #[test]
    fn roundtrip_preserves_bom_and_crlf() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("note.md");
        let before = "\u{feff}# Titel\r\n\r\nHallo.\r\n";
        fs::write(&p, before).unwrap();
        let (path, text, hash) = read_document(&p).unwrap();
        assert_eq!(text, before);
        let mut doc = Document { path, hash };
        let after = before.replace("Hallo", "Servus");
        write_document(&mut doc, after.as_bytes()).unwrap();
        assert_eq!(fs::read_to_string(p).unwrap(), after);
    }
    #[test]
    fn external_changes_are_not_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("note.html");
        fs::write(&p, "<p>Original</p>").unwrap();
        let (path, _, hash) = read_document(&p).unwrap();
        let mut doc = Document { path, hash };
        fs::write(&p, "<p>Extern</p>").unwrap();
        assert!(write_document(&mut doc, b"<p>Editor</p>").is_err());
        assert_eq!(fs::read_to_string(p).unwrap(), "<p>Extern</p>");
    }
    #[test]
    fn binary_pdf_roundtrip_and_conflict_protection() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("binary.PDF");
        let bytes = b"%PDF-1.7\n%\xff\xfe\x80\x00\n%%EOF";
        fs::write(&p, bytes).unwrap();
        let (path, encoded, hash) = read_document(&p).unwrap();
        assert_eq!(save_bytes(&path, encoded).unwrap(), bytes);
        let state = Mutex::new(Store::default());
        assert_eq!(register(&p, &state).unwrap().encoding, "base64");
        let mut doc = Document {path, hash};
        let changed = b"%PDF-1.7\n%\xff\xfe\x80\x00\nnew content\n%%EOF";
        write_document(&mut doc, changed).unwrap();
        assert_eq!(fs::read(&p).unwrap(), changed);
        fs::write(&p, bytes).unwrap();
        assert!(write_document(&mut doc, changed).is_err());
        assert!(save_bytes(&p, "broken base64".into()).is_err());
        assert!(save_bytes(&p, STANDARD.encode(b"not a pdf")).is_err());
    }
    #[test]
    fn invalid_input_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("note.md");
        fs::write(&p, [0xff, 0xfe, 0]).unwrap();
        assert!(read_document(&p).is_err());
        assert!(!supported(Path::new("program.exe")));
        assert!(supported(Path::new("NOTE.HTML")));
    }
}
