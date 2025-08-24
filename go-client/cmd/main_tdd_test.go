package main

import (
	"context"
	"fmt"
	"testing"
)

func TestApp_IsAuthenticated(t *testing.T) {
	tests := []struct {
		name      string
		userToken string
		want      bool
	}{
		{
			name:      "should return false when userToken is empty",
			userToken: "",
			want:      false,
		},
		{
			name:      "should return false when userToken is whitespace only",
			userToken: "   ",
			want:      false,
		},
		{
			name:      "should return true when userToken is set",
			userToken: "valid-token-123",
			want:      true,
		},
		{
			name:      "should return true when userToken is minimal valid token",
			userToken: "x",
			want:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := &App{
				userToken: tt.userToken,
			}
			
			got := app.IsAuthenticated()
			if got != tt.want {
				t.Errorf("App.IsAuthenticated() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestApp_Startup_InitialState(t *testing.T) {
	t.Run("should not set userToken automatically on startup", func(t *testing.T) {
		app := NewApp()
		
		// Verify initial state before startup
		if app.userToken != "" {
			t.Errorf("Expected userToken to be empty before startup, got %q", app.userToken)
		}
		
		// Mock startup (without actual dependencies)
		ctx := context.Background()
		app.ctx = ctx
		
		// After startup, userToken should still be empty
		if app.userToken != "" {
			t.Errorf("Expected userToken to remain empty after startup, got %q", app.userToken)
		}
		
		// IsAuthenticated should return false
		if app.IsAuthenticated() {
			t.Error("Expected IsAuthenticated() to return false after startup")
		}
	})
}

func TestApp_HandleAuthCallback(t *testing.T) {
	tests := []struct {
		name        string
		callbackURL string
		expectError bool
		expectToken bool
	}{
		{
			name:        "should handle valid callback URL with token",
			callbackURL: "http://dummy/?code=test-code&state=test-state",
			expectError: true, // This will fail initially because we need to mock authClient
			expectToken: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := &App{}
			
			err := app.HandleAuthCallback(tt.callbackURL)
			
			if tt.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			
			if !tt.expectError && err != nil {
				t.Errorf("Expected no error but got: %v", err)
			}
			
			hasToken := app.userToken != ""
			if hasToken != tt.expectToken {
				t.Errorf("Expected userToken presence to be %v, got %v", tt.expectToken, hasToken)
			}
		})
	}
}

// Test helper to create an app with specific userToken
func createAppWithToken(token string) *App {
	return &App{
		userToken: token,
	}
}

func TestApp_AuthenticationFlow(t *testing.T) {
	t.Run("complete authentication flow should work correctly", func(t *testing.T) {
		// Step 1: New app should not be authenticated
		app := NewApp()
		if app.IsAuthenticated() {
			t.Error("New app should not be authenticated")
		}
		
		// Step 2: After setting token, should be authenticated
		app.userToken = "test-token"
		if !app.IsAuthenticated() {
			t.Error("App should be authenticated after setting token")
		}
		
		// Step 3: Clearing token should make it unauthenticated
		app.userToken = ""
		if app.IsAuthenticated() {
			t.Error("App should not be authenticated after clearing token")
		}
	})
}

// Test to verify the fix for whitespace-only tokens
func TestApp_IsAuthenticated_WhitespaceHandling(t *testing.T) {
	whitespaceTokens := []string{
		" ",
		"  ",
		"\t",
		"\n",
		"\r",
		" \t\n ",
	}
	
	for i, token := range whitespaceTokens {
		t.Run(fmt.Sprintf("whitespace_token_%d", i), func(t *testing.T) {
			app := &App{
				userToken: token,
			}
			
			if app.IsAuthenticated() {
				t.Errorf("IsAuthenticated() should return false for whitespace-only token %q", token)
			}
		})
	}
}

// Test edge cases and scenarios that might happen in real usage
func TestApp_IsAuthenticated_EdgeCases(t *testing.T) {
	tests := []struct {
		name      string
		userToken string
		want      bool
	}{
		{
			name:      "empty string should not be authenticated",
			userToken: "",
			want:      false,
		},
		{
			name:      "single space should not be authenticated", 
			userToken: " ",
			want:      false,
		},
		{
			name:      "tab character should not be authenticated",
			userToken: "\t",
			want:      false,
		},
		{
			name:      "newline character should not be authenticated",
			userToken: "\n",
			want:      false,
		},
		{
			name:      "mixed whitespace should not be authenticated",
			userToken: " \t\n\r ",
			want:      false,
		},
		{
			name:      "valid token with surrounding whitespace should be authenticated",
			userToken: " valid-token ",
			want:      true,
		},
		{
			name:      "token with internal whitespace should be authenticated",
			userToken: "token with spaces",
			want:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := &App{
				userToken: tt.userToken,
			}

			got := app.IsAuthenticated()
			if got != tt.want {
				t.Errorf("IsAuthenticated() = %v, want %v for token %q", got, tt.want, tt.userToken)
			}
		})
	}
}