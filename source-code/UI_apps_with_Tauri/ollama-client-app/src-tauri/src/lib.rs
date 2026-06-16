// Ollama Chat – Tauri backend
// All Ollama communication happens via the frontend fetch API.
// The Rust backend just bootstraps the Tauri window.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
