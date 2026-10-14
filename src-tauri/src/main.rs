#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod documents;
mod agent_bridge;
fn main() {
    documents::run();
}
