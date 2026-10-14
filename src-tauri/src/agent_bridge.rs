//! Authenticated local IPC for agents. Requests are applied in the live WebView,
//! never by writing behind the editor's back. No network/cloud dependency.
use serde_json::{json, Value};
use std::{collections::HashMap,fs,io::{Read,Write},net::{TcpListener,TcpStream},path::PathBuf,sync::{atomic::{AtomicU64,AtomicUsize,AtomicBool,Ordering},mpsc,Arc,Mutex},time::Duration};
use tauri::{Emitter,Manager,State,WebviewWindow};
#[derive(Default)]
pub struct Bridge {ready:AtomicBool,next:AtomicU64,pending:Mutex<HashMap<u64,mpsc::Sender<Value>>>,connection:Mutex<Value>}
#[tauri::command]
pub fn agent_ready(window:WebviewWindow,state:State<'_,Bridge>)->Result<(),String>{if window.label()!="main" {return Err("Nur im Editor möglich.".into());}state.ready.store(true,Ordering::Release);Ok(())}
#[tauri::command]
pub fn agent_reply(window:WebviewWindow,id:u64,response:Value,state:State<'_,Bridge>)->Result<(),String>{
    if window.label()!="main" {return Err("Nur im Editor möglich.".into());}
    if let Some(tx)=state.pending.lock().map_err(|e|e.to_string())?.remove(&id){let _=tx.send(response);}Ok(())
}
#[tauri::command]
pub fn agent_connection(window:WebviewWindow,state:State<'_,Bridge>)->Result<Value,String>{
    if window.label()!="main" {return Err("Nur im Editor möglich.".into());}
    let v=state.connection.lock().map_err(|e|e.to_string())?;Ok(json!({"port":v["port"],"manifest":v["manifest"]}))
}
const MAX:usize=42*1024*1024;
fn parse(stream:&mut TcpStream,token:&str)->Result<Value,String>{
    let mut bytes=Vec::new();let mut chunk=[0u8;8192];let header_end;
    loop {let n=stream.read(&mut chunk).map_err(|e|e.to_string())?;if n==0{return Err("Unvollständige Anfrage".into());}bytes.extend_from_slice(&chunk[..n]);if let Some(p)=bytes.windows(4).position(|w|w==b"\r\n\r\n"){header_end=p+4;break;}if bytes.len()>16384{return Err("Header zu groß".into());}}
    let header=std::str::from_utf8(&bytes[..header_end]).map_err(|e|e.to_string())?;let mut lines=header.split("\r\n");
    if lines.next()!=Some("POST /rpc HTTP/1.1"){return Err("Nur POST /rpc erlaubt".into());}
    let mut authenticated=false;let mut length=None;
    for line in lines {if let Some((k,v))=line.split_once(':'){let k=k.trim().to_ascii_lowercase();let v=v.trim();match k.as_str(){"authorization"=>authenticated=v==format!("Bearer {token}"),"content-length"=>{if length.is_some(){return Err("Doppelter Content-Length".into());}length=Some(v.parse::<usize>().map_err(|_|"Ungültige Länge")?);},"origin"=>return Err("Browser-Anfragen sind nicht erlaubt".into()),"transfer-encoding"=>return Err("Transfer-Encoding nicht erlaubt".into()),_=>{}}}}
    if !authenticated{return Err("Nicht autorisiert".into());}let length=length.ok_or("Content-Length fehlt")?;if length>MAX{return Err("Anfrage zu groß".into());}
    while bytes.len()-header_end<length {let n=stream.read(&mut chunk).map_err(|e|e.to_string())?;if n==0{return Err("Unvollständige Anfrage".into());}bytes.extend_from_slice(&chunk[..n]);}
    serde_json::from_slice(&bytes[header_end..header_end+length]).map_err(|e|e.to_string())
}
fn respond(mut stream:TcpStream,status:u16,value:Value){let body=value.to_string();let _=write!(stream,"HTTP/1.1 {status} OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body);}
fn handle(mut stream:TcpStream,app:tauri::AppHandle,token:Arc<String>){
    let _=stream.set_read_timeout(Some(Duration::from_secs(5)));let _=stream.set_write_timeout(Some(Duration::from_secs(5)));
    let request=match parse(&mut stream,&token){Ok(v)=>v,Err(e)=>{respond(stream,400,json!({"ok":false,"error":e}));return;}};
    let bridge=app.state::<Bridge>();if !bridge.ready.load(Ordering::Acquire){respond(stream,503,json!({"ok":false,"code":"STARTING","error":"Editor startet noch."}));return;}let id=bridge.next.fetch_add(1,Ordering::Relaxed)+1;let (tx,rx)=mpsc::channel();
    bridge.pending.lock().unwrap().insert(id,tx);
    if let Some(window)=app.get_webview_window("main"){let _=window.emit("agent-request",json!({"id":id,"request":request}));}
    let response=rx.recv_timeout(Duration::from_secs(60)).unwrap_or_else(|_|json!({"ok":false,"error":"Editor antwortet nicht. Zustand vor erneutem Ändern lesen."}));
    bridge.pending.lock().unwrap().remove(&id);respond(stream,200,response);
}
pub fn start(app:tauri::AppHandle)->Result<(),Box<dyn std::error::Error>>{
    let listener=TcpListener::bind(("127.0.0.1",0))?;let port=listener.local_addr()?.port();
    let mut random=[0u8;32];getrandom::fill(&mut random).map_err(|e|std::io::Error::other(e.to_string()))?;
    let token=Arc::new(random.iter().map(|b|format!("{b:02x}")).collect::<String>());
    let dir=app.path().app_local_data_dir()?;fs::create_dir_all(&dir)?;
    let manifest:PathBuf=dir.join(format!("agent-{}.json",std::process::id()));
    let info=json!({"version":1,"pid":std::process::id(),"port":port,"token":*token,"manifest":manifest});
    let mut options=fs::OpenOptions::new();options.write(true).create_new(true);
    #[cfg(unix)] {use std::os::unix::fs::OpenOptionsExt;options.mode(0o600);}
    options.open(&manifest)?.write_all(info.to_string().as_bytes())?;
    *app.state::<Bridge>().connection.lock().unwrap()=info;
    let active=Arc::new(AtomicUsize::new(0));
    std::thread::spawn(move||{for stream in listener.incoming().flatten(){if active.fetch_add(1,Ordering::SeqCst)>=8{active.fetch_sub(1,Ordering::SeqCst);respond(stream,429,json!({"ok":false,"error":"Zu viele Agentenanfragen"}));continue;}let app=app.clone();let token=token.clone();let count=active.clone();std::thread::spawn(move||{handle(stream,app,token);count.fetch_sub(1,Ordering::SeqCst);});}});
    Ok(())
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn ipc_rejects_missing_auth_and_browser_origins(){
        for (headers,expected) in [("Content-Length: 2\r\n","Nicht autorisiert"),("Authorization: Bearer test\r\nOrigin: http://evil\r\nContent-Length: 2\r\n","Browser-Anfragen")]{
            let listener=TcpListener::bind("127.0.0.1:0").unwrap();let addr=listener.local_addr().unwrap();let input=format!("POST /rpc HTTP/1.1\r\n{headers}\r\n{{}}");let sender=std::thread::spawn(move||{let mut s=TcpStream::connect(addr).unwrap();s.write_all(input.as_bytes()).unwrap();});let (mut stream,_)=listener.accept().unwrap();assert!(parse(&mut stream,"test").unwrap_err().contains(expected));sender.join().unwrap();
        }
    }
    #[test]fn ipc_accepts_authenticated_json(){let listener=TcpListener::bind("127.0.0.1:0").unwrap();let addr=listener.local_addr().unwrap();let sender=std::thread::spawn(move||{let mut s=TcpStream::connect(addr).unwrap();s.write_all(b"POST /rpc HTTP/1.1\r\nAuthorization: Bearer test\r\nContent-Length: 17\r\n\r\n{\"method\":\"list\"}").unwrap();});let(mut stream,_)=listener.accept().unwrap();assert_eq!(parse(&mut stream,"test").unwrap()["method"],"list");sender.join().unwrap();}
}
