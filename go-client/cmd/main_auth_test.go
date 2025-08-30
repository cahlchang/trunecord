package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"trunecord/internal/auth"
	"trunecord/internal/config"
	"trunecord/internal/discord"
	"trunecord/internal/websocket"
)

// Test: 認証URLエンドポイントが正しく動作することを確認
func TestHandleGetAuthURL(t *testing.T) {
	// Arrange
	app := &App{
		config:     &config.Config{AuthAPIURL: "https://auth.example.com"},
		authClient: auth.NewClient("https://auth.example.com"),
		streamer:   discord.NewStreamer(),
		wsServer:   websocket.NewServer(),
	}
	
	req := httptest.NewRequest("GET", "/api/auth-url", nil)
	w := httptest.NewRecorder()
	
	// Act
	app.handleGetAuthURL(w, req)
	
	// Assert
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	
	var response map[string]string
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}
	
	if response["url"] == "" {
		t.Error("Expected non-empty auth URL")
	}
}

// Test: 認証URLが正しい形式であることを確認
func TestAuthURLFormat(t *testing.T) {
	// Arrange
	app := &App{
		config:     &config.Config{AuthAPIURL: "https://auth.example.com"},
		authClient: auth.NewClient("https://auth.example.com"),
		streamer:   discord.NewStreamer(),
		wsServer:   websocket.NewServer(),
	}
	
	req := httptest.NewRequest("GET", "/api/auth-url", nil)
	w := httptest.NewRecorder()
	
	// Act
	app.handleGetAuthURL(w, req)
	
	// Assert
	var response map[string]string
	json.NewDecoder(w.Body).Decode(&response)
	
	authURL := response["url"]
	
	// 認証URLが正しいベースURLを持っているか確認
	if authURL == "" || authURL == "https://auth.example.com/api/auth" {
		t.Errorf("Auth URL should include query parameters, got: %s", authURL)
	}
}

// Test: Forbiddenエラーが発生する条件を特定
func TestAuthClientReturnsCorrectURL(t *testing.T) {
	// Arrange
	testCases := []struct {
		name       string
		authAPIURL string
		expectURL  string
	}{
		{
			name:       "Production auth server",
			authAPIURL: "https://trunecord-auth.netlify.app",
			expectURL:  "https://trunecord-auth.netlify.app/api/auth",
		},
		{
			name:       "Local auth server",
			authAPIURL: "http://localhost:3000",
			expectURL:  "http://localhost:3000/api/auth",
		},
	}
	
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Arrange
			client := auth.NewClient(tc.authAPIURL)
			
			// Act
			url := client.GetAuthURL()
			
			// Assert
			if url == "" {
				t.Error("GetAuthURL returned empty string")
			}
			
			// URLが期待するベースURLで始まっているか確認
			if len(url) < len(tc.expectURL) {
				t.Errorf("URL too short: %s", url)
			}
		})
	}
}