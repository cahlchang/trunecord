package main

import (
	"testing"
)

func TestCheckAudioSupport(t *testing.T) {
	// This test will behave differently based on build tags
	err := checkAudioSupport()

	if err != nil {
		// This is expected for nocgo builds
		t.Logf("Audio support check failed (expected for nocgo builds): %v", err)
	} else {
		t.Log("Audio support check passed (CGO build)")
	}

	// The test passes either way - we're just checking that the function exists
	// and can be called without panic
}

func TestApplicationStruct(t *testing.T) {
	// Test that the Application struct is properly defined
	app := Application{}

	// Basic field existence check
	_ = app.config
	_ = app.streamer
	_ = app.wsServer
	_ = app.webServer
	_ = app.authClient

	// If we get here without compilation errors, the struct is properly defined
	t.Log("Application struct is properly defined")
}
