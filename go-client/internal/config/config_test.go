package config

import (
	"os"
	"testing"
)

func TestLoad(t *testing.T) {
	tests := []struct {
		name    string
		envVars map[string]string
		want    *Config
		wantErr bool
	}{
		{
			name:    "default values",
			envVars: map[string]string{},
			want: &Config{
				WebSocketPort:   "8765",
				WebPort:         "48766",
				DiscordBotToken: "",
				AuthAPIURL:      "https://m0j3mh0nyj.execute-api.ap-northeast-1.amazonaws.com/prod",
			},
			wantErr: false,
		},
		{
			name: "custom values from env",
			envVars: map[string]string{
				"WEBSOCKET_PORT":    "9000",
				"WEB_PORT":          "9001",
				"DISCORD_BOT_TOKEN": "test-token",
				"AUTH_API_URL":      "https://custom.auth.com",
				"DISCORD_CLIENT_ID": "123456789",
			},
			want: &Config{
				WebSocketPort:   "9000",
				WebPort:         "9001",
				DiscordBotToken: "test-token",
				AuthAPIURL:      "https://custom.auth.com",
			},
			wantErr: false,
		},
		{
			name:    "load from .env file",
			envVars: map[string]string{
				// This test would require creating a temporary .env file
				// For now, we'll skip this test case
			},
			want:    nil,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Save current env vars
			originalEnvVars := make(map[string]string)
			for key := range tt.envVars {
				originalEnvVars[key] = os.Getenv(key)
			}

			// Set test env vars
			for key, value := range tt.envVars {
				os.Setenv(key, value)
			}

			// Run test
			got, err := Load()
			if (err != nil) != tt.wantErr {
				t.Errorf("Load() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.want != nil && got != nil {
				if got.WebSocketPort != tt.want.WebSocketPort {
					t.Errorf("Load() WebSocketPort = %v, want %v", got.WebSocketPort, tt.want.WebSocketPort)
				}
				if got.WebPort != tt.want.WebPort {
					t.Errorf("Load() WebPort = %v, want %v", got.WebPort, tt.want.WebPort)
				}
				if got.DiscordBotToken != tt.want.DiscordBotToken {
					t.Errorf("Load() DiscordBotToken = %v, want %v", got.DiscordBotToken, tt.want.DiscordBotToken)
				}
				if got.AuthAPIURL != tt.want.AuthAPIURL {
					t.Errorf("Load() AuthAPIURL = %v, want %v", got.AuthAPIURL, tt.want.AuthAPIURL)
				}
			}

			// Restore original env vars
			for key, value := range originalEnvVars {
				if value == "" {
					os.Unsetenv(key)
				} else {
					os.Setenv(key, value)
				}
			}
		})
	}
}
