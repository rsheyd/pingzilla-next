// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args().any(|arg| arg == "--network-quality-smoke-test") {
        if let Err(error) = pingzilla_lib::network_quality_smoke_test() {
            eprintln!("{error}");
            std::process::exit(1);
        }
        return;
    }

    pingzilla_lib::run()
}
