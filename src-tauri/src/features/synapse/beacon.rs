use std::net::UdpSocket;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use super::model::SynapseBeaconPayload;

#[allow(dead_code)]
pub struct SynapseBeaconService {
    running: Arc<AtomicBool>,
}

impl SynapseBeaconService {
    pub fn start() -> Self {
        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        std::thread::Builder::new()
            .name("synapse-beacon-thread".into())
            .spawn(move || {
                let device_name = std::env::var("COMPUTERNAME")
                    .or_else(|_| std::env::var("HOSTNAME"))
                    .unwrap_or_else(|_| "PC-Biglex".to_string());

                let payload = SynapseBeaconPayload {
                    synapse_version: "1.0".to_string(),
                    device_id: format!("prisma_desktop_{}", device_name.to_lowercase().replace(' ', "_")),
                    device_name,
                    device_type: "desktop".to_string(),
                    port: 49288,
                    os: "windows".to_string(),
                    target_app: "prisma".to_string(),
                    capabilities: vec![
                        "handoff".to_string(),
                        "quick-receive".to_string(),
                        "playback-control".to_string(),
                    ],
                };

                let json_data = match serde_json::to_string(&payload) {
                    Ok(json) => json,
                    Err(e) => {
                        eprintln!("[Synapse Beacon] Error serializando payload: {e}");
                        return;
                    }
                };

                let broadcast_addr = "255.255.255.255:49289";

                while running_clone.load(Ordering::Relaxed) {
                    // Se crea el socket UDP y se activa el modo broadcast
                    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
                        let _ = socket.set_broadcast(true);
                        let _ = socket.set_write_timeout(Some(Duration::from_secs(2)));
                        let _ = socket.send_to(json_data.as_bytes(), broadcast_addr);
                    }

                    // Espera de 6 segundos entre emisiones periódicas
                    for _ in 0..12 {
                        if !running_clone.load(Ordering::Relaxed) {
                            break;
                        }
                        std::thread::sleep(Duration::from_millis(500));
                    }
                }
            })
            .expect("No se pudo iniciar el hilo del Beacon de Synapse");

        Self { running }
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }
}
