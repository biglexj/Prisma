#[cfg(feature = "mpv")]
mod mpv;
mod unavailable;

use crate::features::playback::backend::PlaybackBackend;

pub fn create_playback_backend() -> Box<dyn PlaybackBackend> {
    #[cfg(feature = "mpv")]
    {
        return match mpv::MpvBackend::new() {
            Ok(backend) => Box::new(backend),
            Err(reason) => Box::new(unavailable::UnavailableBackend::new(reason)),
        };
    }

    #[cfg(not(feature = "mpv"))]
    Box::new(unavailable::UnavailableBackend::new(
        "Prisma fue compilado sin la feature `mpv`. Actívala para ejecutar el experimento multimedia.",
    ))
}
