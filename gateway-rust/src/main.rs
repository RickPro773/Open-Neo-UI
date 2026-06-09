use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{any, get},
    Json, Router,
};
use serde_json::json;
use std::{env, sync::Arc};
use tower_http::cors::CorsLayer;
use tracing::info;

#[derive(Clone)]
struct AppState {
    api_key: String,
    go_url: String,
    client: reqwest::Client,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let state = Arc::new(AppState {
        api_key: env::var("API_KEY").unwrap_or_else(|_| "dev-key".to_string()),
        go_url: env::var("GO_ORCHESTRATOR_URL")
            .unwrap_or_else(|_| "http://localhost:9090".to_string()),
        client: reqwest::Client::new(),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/*path", any(proxy_to_go))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = "0.0.0.0:8080";
    info!("Gateway Rust rodando em {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok", "service": "gateway-rust" }))
}

async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Response {
    let key = headers
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if key != state.api_key {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "API key inválida" })),
        )
            .into_response();
    }

    next.run(request).await
}

async fn proxy_to_go(
    State(state): State<Arc<AppState>>,
    req: Request,
) -> impl IntoResponse {
    let path = req.uri().path().to_string();
    let target = format!("{}{}", state.go_url, path);

    info!("Proxy → {}", target);

    match state.client.get(&target).send().await {
        Ok(res) => {
            let body = res.text().await.unwrap_or_default();
            (StatusCode::OK, body).into_response()
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}
