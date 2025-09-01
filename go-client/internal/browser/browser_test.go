package browser

import (
	"testing"
)

func TestSanitizeURLForLog(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "HTTP URL with query and fragment",
			input:    "http://localhost:8080/auth/callback?token=secret&guilds=data#section",
			expected: "http://localhost:8080/auth/callback",
		},
		{
			name:     "HTTPS URL with sensitive query params",
			input:    "https://example.com/oauth?client_id=123&client_secret=abc&code=xyz",
			expected: "https://example.com/oauth",
		},
		{
			name:     "URL with userinfo (username:password)",
			input:    "https://user:password@example.com/api",
			expected: "https://example.com/api",
		},
		{
			name:     "URL with port number",
			input:    "http://localhost:3000/path",
			expected: "http://localhost:3000/path",
		},
		{
			name:     "Data URL scheme",
			input:    "data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==",
			expected: "data:<redacted>",
		},
		{
			name:     "JavaScript URL scheme",
			input:    "javascript:alert('XSS')",
			expected: "javascript:<redacted>",
		},
		{
			name:     "Mailto URL scheme",
			input:    "mailto:user@example.com?subject=Secret",
			expected: "mailto:<redacted>",
		},
		{
			name:     "Relative URL",
			input:    "/auth/callback?token=secret",
			expected: "<relative-url>",
		},
		{
			name:     "Invalid URL",
			input:    "://invalid url",
			expected: "<invalid-url>",
		},
		{
			name:     "Simple HTTP URL",
			input:    "http://example.com",
			expected: "http://example.com",
		},
		{
			name:     "HTTPS URL with path",
			input:    "https://api.example.com/v1/users",
			expected: "https://api.example.com/v1/users",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := sanitizeURLForLog(tt.input)
			if result != tt.expected {
				t.Errorf("sanitizeURLForLog(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}