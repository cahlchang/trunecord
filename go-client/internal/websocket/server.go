package websocket

import (
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"trunecord/internal/constants"
)


type Server struct {
	upgrader         websocket.Upgrader
	audioBuffer      chan []byte
	clients          map[*websocket.Conn]bool
	isStreaming      bool
	streamingMutex   sync.RWMutex
	lastAudioTime    time.Time
	timeoutTimer     *time.Timer
	timeoutTimerLock sync.Mutex
	clientMutex      sync.RWMutex
}

type Message struct {
	Type    string `json:"type"`
	Audio   string `json:"audio,omitempty"`
	Version string `json:"version,omitempty"`
}

type StatusResponse struct {
	Type      string `json:"type"`
	Connected bool   `json:"connected"`
	Streaming bool   `json:"streaming"`
}

func NewServer() *Server {
	return &Server{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for Chrome extension
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
		audioBuffer: make(chan []byte, 100), // Reduce buffer size for lower latency
		clients:     make(map[*websocket.Conn]bool),
	}
}

func (s *Server) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// Add client
	s.clientMutex.Lock()
	s.clients[conn] = true
	s.clientMutex.Unlock()
	
	defer func() {
		s.clientMutex.Lock()
		delete(s.clients, conn)
		// If no clients are connected, stop streaming
		if len(s.clients) == 0 {
			s.setStreaming(false)
		}
		s.clientMutex.Unlock()
	}()

	// Send handshake request
	handshakeRequest := map[string]string{
		"type": constants.MessageTypeHandshake,
	}
	if err := conn.WriteJSON(handshakeRequest); err != nil {
		log.Printf("Failed to send handshake request: %v", err)
		return
	}

	for {
		var msg Message
		err := conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		switch msg.Type {
		case constants.MessageTypeHandshake:
			// Check extension version
			if msg.Version != "" {
				if msg.Version != constants.ExpectedExtensionVersion {
					warningMsg := fmt.Sprintf("⚠️ Chrome拡張機能のバージョンが不一致です\n期待: v%s\n実際: v%s\n\n拡張機能を更新してください", 
						constants.ExpectedExtensionVersion, msg.Version)
					log.Printf("\n%s\n", warningMsg)
					
					// Send warning to extension
					warningResponse := map[string]string{
						"type": constants.MessageTypeVersionMismatch,
						"message": warningMsg,
						"expectedVersion": constants.ExpectedExtensionVersion,
						"actualVersion": msg.Version,
					}
					if err := conn.WriteJSON(warningResponse); err != nil {
						log.Printf("Failed to send version warning: %v", err)
					}
				} else {
					log.Printf("✅ Chrome拡張機能バージョン確認: v%s", msg.Version)
				}
			}
		case constants.MessageTypeAudio:
			if msg.Audio != "" {
				// Mark as streaming when we receive audio data
				s.setStreaming(true)
				s.resetStreamingTimeout()

				// Decode base64 audio and send to audio buffer
				audioData, err := base64.StdEncoding.DecodeString(msg.Audio)
				if err != nil {
					log.Printf("Failed to decode audio data: %v", err)
					continue
				}

				select {
				case s.audioBuffer <- audioData:
					// Audio queued successfully
				default:
					// Buffer full, drop oldest chunk to prevent latency
					select {
					case <-s.audioBuffer:
						// Dropped oldest chunk
						s.audioBuffer <- audioData
					default:
						// Still can't add, skip
					}
				}
			}

		case constants.MessageTypeStatus:
			// Send status response
			status := StatusResponse{
				Type:      constants.MessageTypeStatus,
				Connected: true, // TODO: Get actual Discord connection status
				Streaming: s.IsStreaming(),
			}
			if err := conn.WriteJSON(status); err != nil {
				log.Printf("Failed to send status: %v", err)
			}

		case constants.MessageTypeStreamStart:
			s.setStreaming(true)
			log.Println("Received stream start notification from Chrome extension")

		case constants.MessageTypeStreamStop:
			s.setStreaming(false)
			log.Println("Received stream stop notification from Chrome extension")

		case constants.MessageTypeStreamPause:
			s.setStreaming(false)
			log.Println("YouTube Music paused - streaming paused")

		case constants.MessageTypeStreamResume:
			s.setStreaming(true)
			log.Println("YouTube Music resumed - streaming resumed")
		}
	}
}

func (s *Server) GetAudioChannel() <-chan []byte {
	return s.audioBuffer
}

func (s *Server) Start(port string) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.HandleWebSocket)
	log.Printf("WebSocket server starting on port %s", port)
	return http.ListenAndServe(":"+port, mux)
}

func (s *Server) setStreaming(streaming bool) {
	s.streamingMutex.Lock()
	defer s.streamingMutex.Unlock()
	if s.isStreaming != streaming {
		s.isStreaming = streaming
		if streaming {
			log.Println("Chrome extension started streaming audio")
		} else {
			log.Println("Chrome extension stopped streaming audio")
		}
	}
}

func (s *Server) IsStreaming() bool {
	s.streamingMutex.RLock()
	defer s.streamingMutex.RUnlock()
	return s.isStreaming
}

func (s *Server) resetStreamingTimeout() {
	s.timeoutTimerLock.Lock()
	defer s.timeoutTimerLock.Unlock()

	// Cancel existing timer
	if s.timeoutTimer != nil {
		s.timeoutTimer.Stop()
	}

	// Set new timer for streaming timeout (to handle silence in songs)
	s.timeoutTimer = time.AfterFunc(constants.StreamingTimeoutDuration, func() {
		s.setStreaming(false)
		log.Println("Audio streaming timeout - no data received for 10 seconds")
	})
}
