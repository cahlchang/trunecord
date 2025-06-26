package discord

import (
	"testing"
	"time"
)

func TestNewStreamer(t *testing.T) {
	streamer := NewStreamer()

	if streamer == nil {
		t.Fatal("NewStreamer() returned nil")
	}

	if streamer.audioBuffer == nil {
		t.Error("NewStreamer() audioBuffer is nil")
	}

	if streamer.stopChannel == nil {
		t.Error("NewStreamer() stopChannel is nil")
	}

	if streamer.connected {
		t.Error("NewStreamer() should start disconnected")
	}

	if streamer.streaming {
		t.Error("NewStreamer() should not be streaming initially")
	}
}

func TestStreamer_IsConnected(t *testing.T) {
	streamer := NewStreamer()

	if streamer.IsConnected() {
		t.Error("IsConnected() should return false initially")
	}

	// Manually set connected state for testing
	streamer.mutex.Lock()
	streamer.connected = true
	streamer.mutex.Unlock()

	if !streamer.IsConnected() {
		t.Error("IsConnected() should return true after setting connected")
	}
}

func TestStreamer_IsStreaming(t *testing.T) {
	streamer := NewStreamer()

	if streamer.IsStreaming() {
		t.Error("IsStreaming() should return false initially")
	}

	// Manually set streaming state for testing
	streamer.mutex.Lock()
	streamer.streaming = true
	streamer.mutex.Unlock()

	if !streamer.IsStreaming() {
		t.Error("IsStreaming() should return true after setting streaming")
	}
}

func TestStreamer_GetGuildID(t *testing.T) {
	streamer := NewStreamer()
	testGuildID := "test-guild-123"

	if streamer.GetGuildID() != "" {
		t.Error("GetGuildID() should return empty string initially")
	}

	// Set guild ID
	streamer.mutex.Lock()
	streamer.guildID = testGuildID
	streamer.mutex.Unlock()

	if streamer.GetGuildID() != testGuildID {
		t.Errorf("GetGuildID() = %v, want %v", streamer.GetGuildID(), testGuildID)
	}
}

func TestStreamer_GetChannelID(t *testing.T) {
	streamer := NewStreamer()
	testChannelID := "test-channel-456"

	if streamer.GetChannelID() != "" {
		t.Error("GetChannelID() should return empty string initially")
	}

	// Set channel ID
	streamer.mutex.Lock()
	streamer.channelID = testChannelID
	streamer.mutex.Unlock()

	if streamer.GetChannelID() != testChannelID {
		t.Errorf("GetChannelID() = %v, want %v", streamer.GetChannelID(), testChannelID)
	}
}

func TestStreamer_StartStreamingErrors(t *testing.T) {
	streamer := NewStreamer()

	// Test starting streaming when not connected
	audioChannel := make(chan []byte)
	err := streamer.StartStreaming(audioChannel)
	if err == nil {
		t.Error("StartStreaming() should return error when not connected")
	}

	// Test starting streaming when already streaming
	streamer.mutex.Lock()
	streamer.connected = true
	streamer.streaming = true
	// Note: voiceConn would be nil in this test, but that's ok for error testing
	streamer.mutex.Unlock()

	err = streamer.StartStreaming(audioChannel)
	if err == nil {
		t.Error("StartStreaming() should return error when already streaming")
	}
}

func TestStreamer_StopStreaming(t *testing.T) {
	streamer := NewStreamer()

	// Test stopping when not streaming
	err := streamer.StopStreaming()
	if err != nil {
		t.Error("StopStreaming() should not return error when not streaming")
	}

	// Test stopping when streaming
	streamer.mutex.Lock()
	streamer.streaming = true
	streamer.mutex.Unlock()

	err = streamer.StopStreaming()
	if err != nil {
		t.Errorf("StopStreaming() returned error: %v", err)
	}

	if streamer.IsStreaming() {
		t.Error("IsStreaming() should return false after StopStreaming()")
	}
}

func TestStreamer_AudioBuffering(t *testing.T) {
	streamer := NewStreamer()

	// Test that audio buffer can receive data
	testData := []byte{1, 2, 3, 4, 5}

	select {
	case streamer.audioBuffer <- testData:
		// Success
	case <-time.After(100 * time.Millisecond):
		t.Error("Failed to send data to audio buffer")
	}

	// Test that we can read from the buffer
	select {
	case data := <-streamer.audioBuffer:
		if len(data) != len(testData) {
			t.Errorf("Received data length = %d, want %d", len(data), len(testData))
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("Failed to read data from audio buffer")
	}
}

// Note: Testing Connect() and actual streaming would require mocking Discord API,
// which is complex. These tests focus on the basic functionality and state management.
