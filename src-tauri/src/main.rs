#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod documents;
fn main() {
    documents::run();
}
