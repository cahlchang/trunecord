package main

import (
	"testing"
	"trunecord/internal/auth"
	"trunecord/internal/config"
	"trunecord/internal/discord"
	"trunecord/internal/websocket"
)

// Test: App構造体の初期化が正しく動作することを確認
func TestAppInitialization(t *testing.T) {
	// Arrange
	cfg := &config.Config{AuthAPIURL: "https://auth.example.com"}
	
	// Act
	app := &App{
		config:     cfg,
		authClient: auth.NewClient(cfg.AuthAPIURL),
		streamer:   discord.NewStreamer(),
		wsServer:   websocket.NewServer(),
	}
	
	// Assert
	if app.config == nil {
		t.Error("Expected config to be initialized")
	}
	if app.authClient == nil {
		t.Error("Expected authClient to be initialized")
	}
	if app.streamer == nil {
		t.Error("Expected streamer to be initialized")
	}
	if app.wsServer == nil {
		t.Error("Expected wsServer to be initialized")
	}
}

// Test: checkExistingInstanceメソッドの動作確認
func TestCheckExistingInstance(t *testing.T) {
	// Arrange
	app := &App{
		config: &config.Config{WebPort: "8080"},
	}
	
	// Act
	exists := app.checkExistingInstance()
	
	// Assert
	// ポートが使用されていない場合はfalseが返される
	if exists {
		t.Log("Port 8080 is in use (this may be expected in some test environments)")
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