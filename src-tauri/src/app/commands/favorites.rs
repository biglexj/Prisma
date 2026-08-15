use tauri::State;

use crate::{
    app::state::FavoritesState,
    infrastructure::favorites::FavoritesStore,
};

/// Devuelve todos los favoritos agrupados por tipo de medio.
#[tauri::command]
pub fn favorites_get_all(state: State<'_, FavoritesState>) -> Result<FavoritesStore, String> {
    state.get_all()
}

/// Alterna el estado de favorito de un ítem.
/// `media_type` es opcional ("music", "image", "video"); si se omite, se deduce de la extensión.
/// Devuelve `true` si fue añadido, `false` si fue eliminado.
#[tauri::command]
pub fn favorites_toggle(
    path: String,
    media_type: Option<String>,
    state: State<'_, FavoritesState>,
) -> Result<bool, String> {
    state.toggle(media_type.as_deref(), &path)
}

/// Comprueba si un ítem es favorito.
#[tauri::command]
pub fn favorites_is_favorite(
    path: String,
    media_type: Option<String>,
    state: State<'_, FavoritesState>,
) -> Result<bool, String> {
    state.is_favorite(media_type.as_deref(), &path)
}
