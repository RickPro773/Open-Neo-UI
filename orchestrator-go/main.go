package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type ToolCall struct {
	Tool  string         `json:"tool"`
	Input map[string]any `json:"input"`
}

type ToolResult struct {
	Tool   string `json:"tool"`
	Output any    `json:"output"`
	Error  string `json:"error,omitempty"`
}

var (
	mcpURL = getEnv("MCP_SERVER_URL", "http://localhost:8000")
	client = &http.Client{Timeout: 30 * time.Second}
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/tools", handleListTools)
	mux.HandleFunc("/call", handleToolCall)

	addr := "0.0.0.0:9090"
	log.Printf("Orquestrador Go rodando em %s", addr)
	log.Fatal(http.ListenAndServe(addr, corsMiddleware(mux)))
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	respond(w, map[string]string{"status": "ok", "service": "orchestrator-go"})
}

func handleListTools(w http.ResponseWriter, r *http.Request) {
	resp, err := client.Get(mcpURL + "/tools")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	w.Header().Set("Content-Type", "application/json")
	w.Write(body)
}

func handleToolCall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "método não permitido", http.StatusMethodNotAllowed)
		return
	}

	var call ToolCall
	if err := json.NewDecoder(r.Body).Decode(&call); err != nil {
		http.Error(w, "body inválido", http.StatusBadRequest)
		return
	}

	log.Printf("Tool chamada: %s", call.Tool)

	payload, _ := json.Marshal(call.Input)
	resp, err := client.Post(
		fmt.Sprintf("%s/tools/%s", mcpURL, call.Tool),
		"application/json",
		strings.NewReader(string(payload)),
	)
	if err != nil {
		respond(w, ToolResult{Tool: call.Tool, Error: err.Error()})
		return
	}
	defer resp.Body.Close()

	var output any
	json.NewDecoder(resp.Body).Decode(&output)
	respond(w, ToolResult{Tool: call.Tool, Output: output})
}

func respond(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, x-api-key")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
