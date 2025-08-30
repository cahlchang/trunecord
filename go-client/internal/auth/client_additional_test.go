package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGetGuilds(t *testing.T) {
	tests := []struct {
		name       string
		token      string
		statusCode int
		response   []Guild
		wantGuilds int
		wantErr    bool
	}{
		{
			name:       "successful request",
			token:      "valid-token",
			statusCode: http.StatusOK,
			response: []Guild{
				{ID: "guild1", Name: "Test Guild 1", Icon: "icon1.png"},
				{ID: "guild2", Name: "Test Guild 2", Icon: "icon2.png"},
			},
			wantGuilds: 2,
			wantErr:    false,
		},
		{
			name:       "unauthorized",
			token:      "invalid-token",
			statusCode: http.StatusUnauthorized,
			response:   []Guild{},
			wantGuilds: 0,
			wantErr:    true,
		},
		{
			name:       "empty token",
			token:      "",
			statusCode: http.StatusOK,
			response:   []Guild{},
			wantGuilds: 0,
			wantErr:    true,
		},
		{
			name:       "whitespace token",
			token:      "   ",
			statusCode: http.StatusOK,
			response:   []Guild{},
			wantGuilds: 0,
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Skip server setup for empty token tests
			if tt.token == "" || strings.TrimSpace(tt.token) == "" {
				client := NewClient("https://test.api.com")
				_, err := client.GetGuilds(tt.token)
				if (err != nil) != tt.wantErr {
					t.Errorf("GetGuilds() error = %v, wantErr %v", err, tt.wantErr)
				}
				return
			}

			// Create test server
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Check path
				if r.URL.Path != "/api/guilds" {
					t.Errorf("Expected path /api/guilds, got %s", r.URL.Path)
				}

				// Check Authorization header
				authHeader := r.Header.Get("Authorization")
				expectedHeader := "Bearer " + tt.token
				if authHeader != expectedHeader {
					t.Errorf("Expected Authorization header %s, got %s", expectedHeader, authHeader)
				}

				// Check Accept header
				acceptHeader := r.Header.Get("Accept")
				if acceptHeader != "application/json" {
					t.Errorf("Expected Accept header application/json, got %s", acceptHeader)
				}

				w.WriteHeader(tt.statusCode)
				if tt.statusCode == http.StatusOK {
					json.NewEncoder(w).Encode(tt.response)
				}
			}))
			defer server.Close()

			client := NewClient(server.URL)

			got, err := client.GetGuilds(tt.token)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetGuilds() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(got) != tt.wantGuilds {
				t.Errorf("GetGuilds() returned %d guilds, want %d", len(got), tt.wantGuilds)
			}
		})
	}
}

func TestGetChannelsErrorCases(t *testing.T) {
	tests := []struct {
		name    string
		guildID string
		token   string
		wantErr bool
	}{
		{
			name:    "empty guild ID",
			guildID: "",
			token:   "valid-token",
			wantErr: true,
		},
		{
			name:    "whitespace guild ID",
			guildID: "   ",
			token:   "valid-token",
			wantErr: true,
		},
		{
			name:    "invalid guild ID format",
			guildID: "guild123",
			token:   "valid-token",
			wantErr: true,
		},
		{
			name:    "empty token",
			guildID: "123456789012345678",
			token:   "",
			wantErr: true,
		},
		{
			name:    "whitespace token",
			guildID: "123456789012345678",
			token:   "   ",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient("https://test.api.com")

			_, err := client.GetChannels(tt.guildID, tt.token)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetChannels() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestParseAuthCallbackErrorCases(t *testing.T) {
	tests := []struct {
		name        string
		callbackURL string
		wantErr     bool
	}{
		{
			name:        "empty callback URL",
			callbackURL: "",
			wantErr:     true,
		},
		{
			name:        "whitespace callback URL",
			callbackURL: "   ",
			wantErr:     true,
		},
		{
			name:        "malformed URL",
			callbackURL: ":/invalid-url",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient("https://test.api.com")

			_, err := client.ParseAuthCallback(tt.callbackURL)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseAuthCallback() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestVerifyTokenErrorCases(t *testing.T) {
	tests := []struct {
		name    string
		token   string
		wantErr bool
	}{
		{
			name:    "empty token",
			token:   "",
			wantErr: true,
		},
		{
			name:    "whitespace token",
			token:   "   ",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient("https://test.api.com")

			_, err := client.VerifyToken(tt.token)
			if (err != nil) != tt.wantErr {
				t.Errorf("VerifyToken() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestGetBotTokenErrorCases(t *testing.T) {
	tests := []struct {
		name    string
		token   string
		wantErr bool
	}{
		{
			name:    "empty token",
			token:   "",
			wantErr: true,
		},
		{
			name:    "whitespace token",
			token:   "   ",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient("https://test.api.com")

			_, err := client.GetBotToken(tt.token)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetBotToken() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}