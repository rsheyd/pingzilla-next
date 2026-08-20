fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("src/macos_wifi.m")
            .flag("-fobjc-arc")
            .compile("pingzilla_macos_wifi");
        println!("cargo:rustc-link-lib=framework=CoreWLAN");
        println!("cargo:rustc-link-lib=framework=CoreLocation");
    }
    tauri_build::build()
}
