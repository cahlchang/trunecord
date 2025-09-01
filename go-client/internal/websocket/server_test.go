package websocket

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestNewServer(t *testing.T) {
	server := NewServer()

	if server == nil {
		t.Fatal("NewServer() returned nil")
	}

	if server.clients == nil {
		t.Error("NewServer() clients map is nil")
	}

	// Test that audioBuffer exists by accessing through GetAudioChannel
	if server.GetAudioChannel() == nil {
		t.Error("NewServer() GetAudioChannel returns nil")
	}
}

func TestServer_GetAudioChannel(t *testing.T) {
	server := NewServer()

	audioChannel := server.GetAudioChannel()
	if audioChannel == nil {
		t.Fatal("GetAudioChannel() returned nil")
	}

	// Test that we can read from the channel (it's read-only from the API)
	// We can't directly test sending since GetAudioChannel returns a receive-only channel
}

func TestServer_Start(t *testing.T) {
	server := NewServer()
	port := "18765" // Use a different port to avoid conflicts

	// Start server in a goroutine
	serverErr := make(chan error, 1)
	go func() {
		err := server.Start(port)
		serverErr <- err
	}()

	// Give the server time to start
	time.Sleep(100 * time.Millisecond)

	// Try to connect to the server
	url := "ws://localhost:" + port + "/ws"
	dialer := websocket.Dialer{}
	conn, resp, err := dialer.Dial(url, nil)

	if err != nil {
		t.Fatalf("Failed to connect to WebSocket server: %v", err)
	}
	defer conn.Close()

	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Errorf("Expected status %d, got %d", http.StatusSwitchingProtocols, resp.StatusCode)
	}

	// Test sending an audio message (must be base64 encoded in JSON)
	testAudioData := []byte("test audio data")
	testMessage := Message{
		Type:  "audio",
		Audio: base64.StdEncoding.EncodeToString(testAudioData),
	}
	err = conn.WriteJSON(testMessage)
	if err != nil {
		t.Errorf("Failed to send message: %v", err)
	}

	// Verify the message was received through the audio channel
	select {
	case received := <-server.GetAudioChannel():
		if string(received) != string(testAudioData) {
			t.Errorf("Received data = %v, want %v", received, testAudioData)
		}
	case <-time.After(1 * time.Second):
		t.Error("Did not receive audio data from channel")
	}
}

func TestServer_HandleWebSocket(t *testing.T) {
	server := NewServer()

	// Create a test WebSocket server
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		server.HandleWebSocket(w, r)
	}))
	defer testServer.Close()

	// Connect to the test server
	url := "ws" + strings.TrimPrefix(testServer.URL, "http")
	dialer := websocket.Dialer{}
	conn, _, err := dialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	// First, we should receive a handshake message from the server
	var handshakeResponse Message
	err = conn.ReadJSON(&handshakeResponse)
	if err != nil {
		t.Errorf("Failed to read handshake response: %v", err)
	}

	if handshakeResponse.Type != "handshake" {
		t.Errorf("Expected handshake response type 'handshake', got %v", handshakeResponse.Type)
	}

	// Send a status message
	statusMsg := Message{Type: "status"}
	err = conn.WriteJSON(statusMsg)
	if err != nil {
		t.Errorf("Failed to send status message: %v", err)
	}

	// Read the response
	var response StatusResponse
	err = conn.ReadJSON(&response)
	if err != nil {
		t.Errorf("Failed to read status response: %v", err)
	}

	if response.Type != "status" {
		t.Errorf("Expected response type 'status', got %v", response.Type)
	}
}

func TestServer_MultipleClients(t *testing.T) {
	server := NewServer()

	// Create a test WebSocket server
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		server.HandleWebSocket(w, r)
	}))
	defer testServer.Close()

	// Connect multiple clients
	url := "ws" + strings.TrimPrefix(testServer.URL, "http")
	dialer := websocket.Dialer{}

	var conns []*websocket.Conn
	numClients := 3

	for i := 0; i < numClients; i++ {
		conn, _, err := dialer.Dial(url, nil)
		if err != nil {
			t.Fatalf("Failed to connect client %d: %v", i, err)
		}
		conns = append(conns, conn)
	}

	// Give some time for connections to be established
	time.Sleep(100 * time.Millisecond)

	// Test by sending status messages and expecting responses
	for i, conn := range conns {
		statusMsg := Message{Type: "status"}
		err := conn.WriteJSON(statusMsg)
		if err != nil {
			t.Errorf("Failed to send status message from client %d: %v", i, err)
		}
	}

	// Close all connections
	for _, conn := range conns {
		conn.Close()
	}
}
