package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"trunecord/internal/constants"
)

func TestGetAuthURL(t *testing.T) {
	client := NewClient("https://test.api.com")

	expected := "https://test.api.com/api/auth"
	got := client.GetAuthURL()

	if got != expected {
		t.Errorf("GetAuthURL() = %v, want %v", got, expected)
	}
}

func TestParseAuthCallback(t *testing.T) {
	tests := []struct {
		name        string
		callbackURL string
		wantToken   string
		wantGuilds  int
		wantErr     bool
	}{
		{
			name:        "valid callback",
			callbackURL: "https://example.com/callback?token=test-token&guilds=%5B%7B%22id%22%3A%22123%22%2C%22name%22%3A%22Test%22%2C%22icon%22%3A%22icon.png%22%7D%5D",
			wantToken:   "test-token",
			wantGuilds:  1,
			wantErr:     false,
		},
		{
			name:        "missing token",
			callbackURL: "https://example.com/callback?guilds=%5B%5D",
			wantToken:   "",
			wantGuilds:  0,
			wantErr:     true,
		},
		{
			name:        "invalid URL",
			callbackURL: "not-a-url",
			wantToken:   "",
			wantGuilds:  0,
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient("https://test.api.com")

			got, err := client.ParseAuthCallback(tt.callbackURL)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseAuthCallback() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if got.Token != tt.wantToken {
					t.Errorf("ParseAuthCallback() Token = %v, want %v", got.Token, tt.wantToken)
				}
				if len(got.Guilds) != tt.wantGuilds {
					t.Errorf("ParseAuthCallback() Guilds count = %v, want %v", len(got.Guilds), tt.wantGuilds)
				}
			}
		})
	}
}

func TestGetChannels(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check path
		if r.URL.Path != "/api/guilds/123456789012345678/channels" {
			t.Errorf("Expected path /api/guilds/123456789012345678/channels, got %s", r.URL.Path)
		}

		// Check Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader != "Bearer test-token" {
			t.Errorf("Expected Authorization header 'Bearer test-token', got %s", authHeader)
		}

		// Send response
		response := ChannelsResponse{
			Channels: []Channel{
				{ID: "channel1", Name: "General", Position: 0},
				{ID: "channel2", Name: "Voice", Position: 1},
			},
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	client := NewClient(server.URL)

	channels, err := client.GetChannels("123456789012345678", "test-token")
	if err != nil {
		t.Errorf("GetChannels() error = %v", err)
		return
	}

	if len(channels) != 2 {
		t.Errorf("GetChannels() returned %d channels, want 2", len(channels))
	}
}

func TestVerifyToken(t *testing.T) {
	tests := []struct {
		name       string
		token      string
		statusCode int
		wantValid  bool
		wantErr    bool
	}{
		{
			name:       "valid token",
			token:      "valid-token",
			statusCode: http.StatusOK,
			wantValid:  true,
			wantErr:    false,
		},
		{
			name:       "invalid token",
			token:      "invalid-token",
			statusCode: http.StatusUnauthorized,
			wantValid:  false,
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test server
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Check Authorization header
				authHeader := r.Header.Get("Authorization")
				expectedHeader := "Bearer " + tt.token
				if authHeader != expectedHeader {
					t.Errorf("Expected Authorization header %s, got %s", expectedHeader, authHeader)
				}

				w.WriteHeader(tt.statusCode)
			}))
			defer server.Close()

			client := NewClient(server.URL)

			got, err := client.VerifyToken(tt.token)
			if (err != nil) != tt.wantErr {
				t.Errorf("VerifyToken() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if got != tt.wantValid {
				t.Errorf("VerifyToken() = %v, want %v", got, tt.wantValid)
			}
		})
	}
}

func TestGetBotToken(t *testing.T) {
	tests := []struct {
		name       string
		token      string
		statusCode int
		response   BotTokenResponse
		wantToken  string
		wantErr    bool
	}{
		{
			name:       "successful request",
			token:      "valid-token",
			statusCode: http.StatusOK,
			response: BotTokenResponse{
				BotToken: "bot-token-123",
				Warning:  "",
			},
			wantToken: "bot-token-123",
			wantErr:   false,
		},
		{
			name:       "unauthorized",
			token:      "invalid-token",
			statusCode: http.StatusUnauthorized,
			response:   BotTokenResponse{},
			wantToken:  "",
			wantErr:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create test server
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Check path
				if r.URL.Path != "/api/bot-token" {
					t.Errorf("Expected path /api/bot-token, got %s", r.URL.Path)
				}

				// Check Authorization header
				authHeader := r.Header.Get("Authorization")
				expectedHeader := "Bearer " + tt.token
				if authHeader != expectedHeader {
					t.Errorf("Expected Authorization header %s, got %s", expectedHeader, authHeader)
				}

				w.WriteHeader(tt.statusCode)
				if tt.statusCode == http.StatusOK {
					json.NewEncoder(w).Encode(tt.response)
				}
			}))
			defer server.Close()

			client := NewClient(server.URL)

			got, err := client.GetBotToken(tt.token)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetBotToken() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if got != tt.wantToken {
				t.Errorf("GetBotToken() = %v, want %v", got, tt.wantToken)
			}
		})
	}
}

func TestGetVersionInfo(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != constants.APIVersionPath {
				t.Fatalf("unexpected path: %s", r.URL.Path)
			}
			if accept := r.Header.Get(constants.AcceptHeader); accept != constants.ContentTypeJSON {
				t.Fatalf("unexpected accept header: %s", accept)
			}
			w.Header().Set("Content-Type", constants.ContentTypeJSON)
			json.NewEncoder(w).Encode(VersionInfo{
				GoClient: VersionComponent{
					LatestVersion:  "2.0.0",
					MinimumVersion: "1.9.0",
					DownloadURL:    "https://example.com/go",
					ReleaseNotes:   "client notes",
				},
				ChromeExtension: VersionComponent{
					LatestVersion:  "3.0.0",
					MinimumVersion: "2.5.0",
					DownloadURL:    "https://example.com/ext",
					ReleaseNotes:   "extension notes",
				},
				LastCheckedAt: "2025-01-01T00:00:00Z",
			})
		}))
		defer ts.Close()

		client := NewClient(ts.URL)
		info, err := client.GetVersionInfo()
		if err != nil {
			t.Fatalf("GetVersionInfo() error = %v", err)
		}

		if info.GoClient.LatestVersion != "2.0.0" || info.GoClient.MinimumVersion != "1.9.0" {
			t.Fatalf("unexpected go client versions: %+v", info.GoClient)
		}
		if info.ChromeExtension.DownloadURL != "https://example.com/ext" {
			t.Fatalf("unexpected extension download URL: %s", info.ChromeExtension.DownloadURL)
		}
	})

	t.Run("api error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusBadGateway)
			w.Write([]byte("bad gateway"))
		}))
		defer ts.Close()

		client := NewClient(ts.URL)
		_, err := client.GetVersionInfo()
		if err == nil {
			t.Fatalf("expected error, got nil")
		}
	})
}
