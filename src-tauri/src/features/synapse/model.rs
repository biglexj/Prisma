use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynapseBeaconPayload {
    pub synapse_version: String,
    pub device_id: String,
    pub device_name: String,
    pub device_type: String,
    pub port: u16,
    pub os: String,
    pub target_app: String,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynapseHandoffPayload {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub path: Option<String>,
    pub position_ms: Option<u64>,
    pub duration_ms: Option<u64>,
    pub is_playing: Option<bool>,
    pub is_video: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynapseStatusResponse {
    pub success: bool,
    pub message: String,
    pub target_app: String,
    pub synapse_version: String,
    pub device_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynapseActionResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub saved_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SynapseOpenMediaEvent {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_time: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autoplay: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SynapseFileReceivedEvent {
    pub file_name: String,
    pub saved_path: String,
    pub media_type: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SynapseRemoteCommandPayload {
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dx: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dy: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SynapsePlaybackStatus {
    pub is_playing: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub is_video: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artwork_url: Option<String>,
}
