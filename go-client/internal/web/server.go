package web

import (
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"strings"

	"trunecord/internal/auth"
)

type Server struct {
	port       string
	authClient *auth.Client
	templates  *template.Template
	tokenData  *auth.TokenData
	streamer   DiscordStreamer
	wsServer   WebSocketServer
}

type DiscordStreamer interface {
	Connect(botToken, guildID, channelID string) error
	Disconnect() error
	IsConnected() bool
	IsStreaming() bool
	GetGuildID() string
	GetChannelID() string
}

type WebSocketServer interface {
	IsStreaming() bool
}

type PageData struct {
	Title     string
	AuthURL   string
	Guilds    []auth.Guild
	Error     string
	Success   string
	Token     string
	Connected bool
	Streaming bool
}

func NewServer(port string, authClient *auth.Client, streamer DiscordStreamer, wsServer WebSocketServer) *Server {
	return &Server{
		port:       port,
		authClient: authClient,
		streamer:   streamer,
		wsServer:   wsServer,
	}
}

func (s *Server) Start() error {
	// Always use inline templates
	s.templates = template.New("")
	s.loadInlineTemplates()
	log.Println("Using inline templates")

	// Create a new mux for this server
	mux := http.NewServeMux()

	// Routes
	mux.HandleFunc("/", s.handleHome)
	mux.HandleFunc("/auth", s.handleAuth)
	mux.HandleFunc("/auth/callback", s.handleCallback)
	mux.HandleFunc("/auth/success", s.handleAuthSuccess)
	mux.HandleFunc("/api/connect", s.handleConnect)
	mux.HandleFunc("/api/disconnect", s.handleDisconnect)
	mux.HandleFunc("/api/status", s.handleStatus)
	mux.HandleFunc("/api/channels/", s.handleChannels)

	// Static files
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("web/static/"))))

	log.Printf("Web server starting on port %s", s.port)

	// Auto-open browser
	go s.openBrowser()

	return http.ListenAndServe(":"+s.port, mux)
}

func (s *Server) openBrowser() {
	url := fmt.Sprintf("http://localhost:%s", s.port)
	var err error

	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		log.Printf("Cannot auto-open browser on this platform. Please visit: %s", url)
		return
	}

	if err != nil {
		log.Printf("Failed to open browser: %v", err)
		log.Printf("Please manually visit: %s", url)
	}
}

func (s *Server) handleHome(w http.ResponseWriter, r *http.Request) {
	data := PageData{
		Title:   "trunecord",
		AuthURL: s.authClient.GetAuthURL(),
	}

	if s.tokenData != nil {
		data.Guilds = s.tokenData.Guilds
		data.Token = s.tokenData.Token
	}

	log.Printf("Rendering home page with %d guilds, token: %v", len(data.Guilds), data.Token != "")

	// Set proper content type
	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	err := s.templates.ExecuteTemplate(w, "index.html", data)
	if err != nil {
		log.Printf("Template execution error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("Template rendered successfully")
}

func (s *Server) handleAuth(w http.ResponseWriter, r *http.Request) {
	authURL := s.authClient.GetAuthURL()
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func (s *Server) handleCallback(w http.ResponseWriter, r *http.Request) {
	// Parse token and guilds from URL parameters
	token := r.URL.Query().Get("token")
	guildsParam := r.URL.Query().Get("guilds")

	if token == "" || guildsParam == "" {
		log.Printf("Missing token or guilds in callback")
		http.Redirect(w, r, "/?error="+url.QueryEscape("Missing authentication data"), http.StatusTemporaryRedirect)
		return
	}

	// Parse guilds JSON
	var guilds []auth.Guild
	err := json.Unmarshal([]byte(guildsParam), &guilds)
	if err != nil {
		log.Printf("Failed to parse guilds: %v", err)
		http.Redirect(w, r, "/?error="+url.QueryEscape("Failed to parse authentication data"), http.StatusTemporaryRedirect)
		return
	}

	// Store token data
	s.tokenData = &auth.TokenData{
		Token:  token,
		Guilds: guilds,
	}
	log.Printf("Successfully authenticated with %d guilds", len(guilds))

	// Redirect to home page where guilds will be displayed
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

func (s *Server) handleAuthSuccess(w http.ResponseWriter, r *http.Request) {
	// Check if we have token data from callback
	if s.tokenData == nil {
		http.Redirect(w, r, "/?error="+url.QueryEscape("Not authenticated"), http.StatusTemporaryRedirect)
		return
	}

	data := PageData{
		Title:   "Authentication Successful",
		Success: "Successfully authenticated with Discord!",
		Guilds:  s.tokenData.Guilds,
		Token:   s.tokenData.Token,
	}

	// Set proper content type
	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	err := s.templates.ExecuteTemplate(w, "success.html", data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (s *Server) handleConnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		GuildID   string `json:"guildId"`
		ChannelID string `json:"channelId"`
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if s.tokenData == nil {
		http.Error(w, "Not authenticated", http.StatusUnauthorized)
		return
	}

	// Get Discord bot token from auth server
	botToken, err := s.authClient.GetBotToken(s.tokenData.Token)
	if err != nil {
		log.Printf("Failed to get bot token: %v", err)
		response := map[string]interface{}{
			"success": false,
			"message": "Failed to get bot token from server",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Connect to Discord voice channel
	err = s.streamer.Connect(botToken, req.GuildID, req.ChannelID)
	if err != nil {
		log.Printf("Failed to connect to Discord: %v", err)
		response := map[string]interface{}{
			"success": false,
			"message": fmt.Sprintf("Failed to connect: %v", err),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	log.Printf("Successfully connected to Discord voice channel %s in guild %s", req.ChannelID, req.GuildID)

	response := map[string]interface{}{
		"success": true,
		"message": "Connected to Discord voice channel",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleDisconnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Disconnect from Discord
	err := s.streamer.Disconnect()
	if err != nil {
		log.Printf("Failed to disconnect from Discord: %v", err)
		response := map[string]interface{}{
			"success": false,
			"message": fmt.Sprintf("Failed to disconnect: %v", err),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	log.Printf("Successfully disconnected from Discord")

	response := map[string]interface{}{
		"success": true,
		"message": "Disconnected from Discord",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	// Check if Chrome extension is actually streaming audio
	chromeStreaming := false
	if s.wsServer != nil {
		chromeStreaming = s.wsServer.IsStreaming()
	}

	status := map[string]interface{}{
		"connected":     s.streamer.IsConnected(),
		"streaming":     chromeStreaming && s.streamer.IsConnected(), // Both must be true
		"authenticated": s.tokenData != nil,
	}

	if s.tokenData != nil {
		status["guilds"] = s.tokenData.Guilds
	}

	if s.streamer.IsConnected() {
		status["currentGuild"] = s.streamer.GetGuildID()
		status["currentChannel"] = s.streamer.GetChannelID()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func (s *Server) handleChannels(w http.ResponseWriter, r *http.Request) {
	if s.tokenData == nil {
		http.Error(w, "Not authenticated", http.StatusUnauthorized)
		return
	}

	// Extract guild ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	guildID := pathParts[3]

	channels, err := s.authClient.GetChannels(s.tokenData.Token, guildID)
	if err != nil {
		log.Printf("Failed to get channels: %v", err)
		http.Error(w, "Failed to get channels", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"channels": channels,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *Server) loadInlineTemplates() {
	// Templates are loaded from templates.go
	var err error

	log.Printf("Loading index template, length: %d bytes", len(indexTemplate))
	_, err = s.templates.New("index.html").Parse(indexTemplate)
	if err != nil {
		log.Printf("Failed to parse index template: %v", err)
		// Fallback to basic template
		s.templates.New("index.html").Parse(`<!DOCTYPE html><html><body><h1>Template Error</h1><p>` + err.Error() + `</p></body></html>`)
	} else {
		log.Printf("Successfully parsed index template")
	}

	log.Printf("Loading success template, length: %d bytes", len(successTemplate))
	_, err = s.templates.New("success.html").Parse(successTemplate)
	if err != nil {
		log.Printf("Failed to parse success template: %v", err)
		s.templates.New("success.html").Parse(`<!DOCTYPE html><html><body><h1>Success</h1></body></html>`)
	} else {
		log.Printf("Successfully parsed success template")
	}

	// List all loaded templates
	log.Printf("Loaded templates:")
	for _, t := range s.templates.Templates() {
		log.Printf("  - %s", t.Name())
	}
}
