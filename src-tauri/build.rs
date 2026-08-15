// Build script para Tauri v2 y runtime mpv
fn main() {
    ensure_probe_icon();
    configure_libmpv();
    tauri_build::build();
}


fn configure_libmpv() {
    println!("cargo:rerun-if-env-changed=PRISMA_LIBMPV_DIR");

    if std::env::var_os("CARGO_FEATURE_MPV").is_none() || !cfg!(target_os = "windows") {
        return;
    }

    let manifest_dir = std::path::PathBuf::from(
        std::env::var_os("CARGO_MANIFEST_DIR").expect("Cargo no proporcionó CARGO_MANIFEST_DIR"),
    );
    let libmpv_dir = std::env::var_os("PRISMA_LIBMPV_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| manifest_dir.join("vendor").join("libmpv"));
    let import_library = libmpv_dir.join("lib").join("libmpv.dll.a");

    if !import_library.is_file() {
        panic!(
            "No se encontró libmpv en '{}'. Ejecuta `powershell -ExecutionPolicy Bypass -File scripts/setup-libmpv.ps1` desde la raíz de Prisma.",
            libmpv_dir.display()
        );
    }

    println!(
        "cargo:rustc-link-search=native={}",
        import_library
            .parent()
            .expect("La biblioteca de importación no tiene carpeta")
            .display()
    );
    println!("cargo:rerun-if-changed={}", import_library.display());

    copy_libmpv_runtime(&libmpv_dir);
}

fn copy_libmpv_runtime(libmpv_dir: &std::path::Path) {
    let bin_dir = libmpv_dir.join("bin");
    let runtime_dll = std::fs::read_dir(&bin_dir)
        .unwrap_or_else(|error| {
            panic!(
                "No se pudo leer la carpeta de runtime '{}': {error}",
                bin_dir.display()
            )
        })
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            path.extension().is_some_and(|extension| extension == "dll")
                && path
                    .file_stem()
                    .is_some_and(|name| name.to_string_lossy().starts_with("libmpv-"))
        })
        .unwrap_or_else(|| panic!("No se encontró la DLL de mpv en '{}'.", bin_dir.display()));

    let out_dir = std::path::PathBuf::from(
        std::env::var_os("OUT_DIR").expect("Cargo no proporcionó OUT_DIR"),
    );
    let profile_dir = out_dir
        .ancestors()
        .nth(3)
        .expect("No se pudo resolver la carpeta del perfil de Cargo");
    let destination = profile_dir.join(
        runtime_dll
            .file_name()
            .expect("La DLL de mpv no tiene nombre de archivo"),
    );

    if destination.exists() {
        println!("cargo:rerun-if-changed={}", runtime_dll.display());
        return;
    }

    let _ = std::fs::copy(&runtime_dll, &destination);
    println!("cargo:rerun-if-changed={}", runtime_dll.display());

}

fn ensure_probe_icon() {
    let icon_path = std::path::Path::new("icons/icon.ico");
    if icon_path.exists() {
        return;
    }

    std::fs::create_dir_all("icons").expect("No se pudo crear la carpeta temporal de iconos");
    std::fs::write(icon_path, PROBE_ICON)
        .expect("No se pudo escribir el icono provisional de Prisma");
}

// ICO mínimo de 1 × 1 píxel en #00AAFF. Solo desbloquea la prueba técnica.
const PROBE_ICON: &[u8] = &[
    0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x20, 0x00, 0x30, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00,
    0x00, 0x00, 0x01, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xAA,
    0x00, 0xFF, 0x00, 0x00, 0x00, 0x00,
];
