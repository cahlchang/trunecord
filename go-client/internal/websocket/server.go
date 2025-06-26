package websocket

import (
	"encoding/base64"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
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
}

type Message struct {
	Type  string `json:"type"`
	Audio string `json:"audio,omitempty"`
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
		},
		audioBuffer: make(chan []byte, 1000),
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

	s.clients[conn] = true
	defer func() {
		delete(s.clients, conn)
		// If no clients are connected, stop streaming
		if len(s.clients) == 0 {
			s.setStreaming(false)
		}
	}()

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
		case "audio":
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
					// Buffer full, skip this chunk
					log.Printf("Audio buffer full, dropping chunk")
				}
			}

		case "status":
			// Send status response
			status := StatusResponse{
				Type:      "status",
				Connected: true, // TODO: Get actual Discord connection status
				Streaming: s.IsStreaming(),
			}
			if err := conn.WriteJSON(status); err != nil {
				log.Printf("Failed to send status: %v", err)
			}
			
		case "streamStart":
			s.setStreaming(true)
			log.Println("Received stream start notification from Chrome extension")
			
		case "streamStop":
			s.setStreaming(false)
			log.Println("Received stream stop notification from Chrome extension")
			
		case "streamPause":
			s.setStreaming(false)
			log.Println("YouTube Music paused - streaming paused")
			
		case "streamResume":
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
	
	// Set new timer for 10 seconds (to handle silence in songs)
	s.timeoutTimer = time.AfterFunc(10*time.Second, func() {
		s.setStreaming(false)
		log.Println("Audio streaming timeout - no data received for 10 seconds")
	})
}