//! Arrastre de StorageFile desde el host mediante CoreDragOperation asíncrono.

#[cfg(windows)]
pub(super) mod native {
    use std::sync::atomic::{AtomicBool, Ordering};
    use windows::{
        ApplicationModel::DataTransfer::{DataPackageOperation, DragDrop::Core::*},
        Foundation::{
            AsyncOperationCompletedHandler, Collections::IIterable, IAsyncOperation, Point,
        },
        Graphics::Imaging::*,
        Storage::{IStorageItem, StorageFile},
        Win32::{Foundation::*, System::WinRT::IDragDropManagerInterop},
        core::*,
    };

    static ACTIVE: AtomicBool = AtomicBool::new(false);
    struct Running {
        generation: u64,
        _source: CoreDragOperation,
        _manager: CoreDragDropManager,
        pending: IAsyncOperation<DataPackageOperation>,
    }
    thread_local! { static RUNNING: std::cell::RefCell<Option<Running>> = const { std::cell::RefCell::new(None) }; }
    static GENERATION: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    fn finish(generation: u64, cancel: bool) -> bool {
        let running = RUNNING.with(|slot| {
            let mut slot = slot.borrow_mut();
            if slot
                .as_ref()
                .is_some_and(|value| value.generation == generation)
            {
                slot.take()
            } else {
                None
            }
        });
        if cancel {
            if let Some(running) = running.as_ref() {
                let _ = running.pending.Cancel();
            }
        }
        running.is_some()
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use base64::Engine;
        #[test]
        fn pointer_preview_preserves_alpha_and_rejects_invalid_images() {
            let image = image::RgbaImage::from_raw(1, 1, vec![200, 100, 50, 128]).unwrap();
            let mut bytes = std::io::Cursor::new(Vec::new());
            image.write_to(&mut bytes, image::ImageFormat::Png).unwrap();
            let icon = format!(
                "data:image/png;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(bytes.into_inner())
            );
            let (pixels, width, height) = preview(&icon).unwrap();
            assert_eq!((width, height), (1, 1));
            assert_eq!(pixels, vec![25, 50, 100, 128]);
            assert!(preview("data:image/png;base64,AAAA").is_err());
            assert!(preview("data:image/jpeg;base64,AAAA").is_err());
        }
    }

    pub(crate) fn preview(icon: &str) -> Result<(Vec<u8>, u32, u32)> {
        use base64::Engine;
        let png = icon
            .strip_prefix("data:image/png;base64,")
            .ok_or_else(|| Error::from(E_INVALIDARG))?;
        if png.len() > 1_000_000 {
            return Err(Error::from(E_INVALIDARG));
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(png)
            .map_err(|_| Error::from(E_INVALIDARG))?;
        let (width, height) =
            image::ImageReader::with_format(std::io::Cursor::new(&bytes), image::ImageFormat::Png)
                .into_dimensions()
                .map_err(|_| Error::from(E_INVALIDARG))?;
        if width == 0 || height == 0 || width > 512 || height > 512 {
            return Err(Error::from(E_INVALIDARG));
        }
        let image = image::load_from_memory_with_format(&bytes, image::ImageFormat::Png)
            .map_err(|_| Error::from(E_INVALIDARG))?
            .to_rgba8();
        let mut bgra = image.into_raw();
        for p in bgra.chunks_exact_mut(4) {
            p.swap(0, 2);
            for c in 0..3 {
                p[c] = ((p[c] as u16 * p[3] as u16 + 127) / 255) as u8;
            }
        }
        Ok((bgra, width, height))
    }

    /// Se llama desde el WM_POINTERUPDATE de una superficie del host; conserva
    /// el propietario y el mensaje nativos que no están disponibles en el DOM.
    pub(crate) fn start_prepared(
        window: tauri::WebviewWindow,
        file: StorageFile,
        bitmap: SoftwareBitmap,
        id: u32,
    ) -> Result<()> {
        use tauri::Emitter;
        if ACTIVE.swap(true, Ordering::AcqRel) {
            return Err(Error::new(E_ABORT, "Ya hay un arrastre en curso"));
        }
        let generation = GENERATION.fetch_add(1, Ordering::AcqRel) + 1;
        let result = (|| -> Result<()> {
            unsafe {
                let hwnd = HWND(window.hwnd().map_err(|_| Error::from(E_HANDLE))?.0);
                let factory: IDragDropManagerInterop =
                    factory::<CoreDragDropManager, IDragDropManagerInterop>()?;
                let manager: CoreDragDropManager = factory.GetForWindow(hwnd)?;
                let item: IStorageItem = file.cast()?;
                let items = IIterable::<IStorageItem>::try_from(vec![Some(item)])?;
                let operation = CoreDragOperation::new()?;
                operation.SetPointerId(id).map_err(|e| {
                    Error::new(e.code(), format!("Vincular contacto de lápiz: {e}"))
                })?;
                operation.SetAllowedOperations(DataPackageOperation::Copy)?;
                operation
                    .Data()?
                    .SetStorageItems(&items, true)
                    .map_err(|e| Error::new(e.code(), format!("Entregar archivo nativo: {e}")))?;
                operation.SetDragUIContentFromSoftwareBitmapWithAnchorPoint(
                    &bitmap,
                    Point {
                        X: bitmap.PixelWidth()? as f32 / 2.0,
                        Y: bitmap.PixelHeight()? as f32 / 2.0,
                    },
                )?;
                let pending = operation
                    .StartAsync()
                    .map_err(|e| Error::new(e.code(), format!("Iniciar arrastre de lápiz: {e}")))?;
                RUNNING.with(|slot| {
                    *slot.borrow_mut() = Some(Running {
                        generation,
                        _source: operation,
                        _manager: manager,
                        pending: pending.clone(),
                    })
                });
                super::super::synapse_drag_surface::set_active(&window, true);
                let target = window.clone();
                pending.SetCompleted(&AsyncOperationCompletedHandler::new(
                    move |op: Option<&IAsyncOperation<DataPackageOperation>>, _| {
                        let result = op
                            .ok_or_else(|| Error::from(E_ABORT))
                            .and_then(|op| op.GetResults());
                        let done = target.clone();
                        let _ = target.run_on_main_thread(move || {
                            if finish(generation, false) {
                                ACTIVE.store(false, Ordering::Release);
                                super::super::synapse_drag_surface::set_active(&done, false);
                                #[cfg(debug_assertions)]
                                eprintln!("[Synapse nativo] Fin del arrastre: {result:?}");
                                if let Err(error) = result {
                                    let _ = done.emit_to(
                                        done.label(),
                                        "prisma:synapse-native-error",
                                        error.to_string(),
                                    );
                                }
                            }
                        });
                        Ok(())
                    },
                ))?;
                eprintln!(
                    "[Synapse nativo] CoreDragOperation iniciado desde superficie propia, puntero={id}"
                );
                Ok(())
            }
        })();
        if result.is_err() {
            finish(generation, true);
            ACTIVE.store(false, Ordering::Release);
            super::super::synapse_drag_surface::set_active(&window, false);
        } else {
            let target = window.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(120)).await;
                let notify = target.clone();
                let _ = target.run_on_main_thread(move || {
                    if RUNNING.with(|slot| {
                        slot.borrow()
                            .as_ref()
                            .is_some_and(|value| value.generation == generation)
                    }) {
                        finish(generation, true);
                        ACTIVE.store(false, Ordering::Release);
                        super::super::synapse_drag_surface::set_active(&notify, false);
                        let _ = notify.emit_to(
                            notify.label(),
                            "prisma:synapse-native-error",
                            "El arrastre se canceló por tiempo de espera",
                        );
                    }
                });
            });
        }
        result
    }
}
