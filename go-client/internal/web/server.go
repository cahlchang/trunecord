package web

import (
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"

	"trunecord/internal/auth"
	"trunecord/internal/browser"
	"trunecord/internal/config"
	"trunecord/internal/constants"
)

type Server struct {
	port             string
	authClient       *auth.Client
	templates        *template.Template
	tokenData        *auth.TokenData
	streamer         DiscordStreamer
	wsServer         WebSocketServer
	browserOpener    *browser.Opener
	config           *config.Config
	versionStatus    *VersionStatus
	versionStatusMu  sync.RWMutex
	versionStatusErr string
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
	IsConnected() bool
}

type PageData struct {
	Title         string
	AuthURL       string
	Guilds        []auth.Guild
	Error         string
	Success       string
	Token         string
	Connected     bool
	Streaming     bool
	VersionStatus *VersionStatus
	VersionError  string
}

type ComponentUpdate struct {
	Name              string `json:"name"`
	CurrentVersion    string `json:"currentVersion"`
	LatestVersion     string `json:"latestVersion"`
	MinimumVersion    string `json:"minimumVersion"`
	DownloadURL       string `json:"downloadUrl"`
	ReleaseNotes      string `json:"releaseNotes"`
	UpdateRequired    bool   `json:"updateRequired"`
	UpdateRecommended bool   `json:"updateRecommended"`
}

type VersionStatus struct {
	GoClient        ComponentUpdate `json:"goClient"`
	ChromeExtension ComponentUpdate `json:"chromeExtension"`
	HasUpdate       bool            `json:"hasUpdate"`
}

func NewServer(port string, authClient *auth.Client, streamer DiscordStreamer, wsServer WebSocketServer, cfg *config.Config) *Server {
	return &Server{
		port:          port,
		authClient:    authClient,
		streamer:      streamer,
		wsServer:      wsServer,
		browserOpener: browser.NewOpener(),
		config:        cfg,
	}
}

func (s *Server) refreshVersionStatus() error {
	if s.authClient == nil {
		return fmt.Errorf("auth client not configured")
	}

	info, err := s.authClient.GetVersionInfo()
	if err != nil {
		s.versionStatusMu.Lock()
		s.versionStatusErr = err.Error()
		s.versionStatusMu.Unlock()
		return err
	}

	status := &VersionStatus{
		GoClient:        buildComponentUpdate("Go Client", constants.ApplicationVersion, info.GoClient),
		ChromeExtension: buildComponentUpdate("Chrome Extension", constants.ExpectedExtensionVersion, info.ChromeExtension),
	}
	status.HasUpdate = status.GoClient.UpdateRequired || status.GoClient.UpdateRecommended || status.ChromeExtension.UpdateRequired || status.ChromeExtension.UpdateRecommended

	s.versionStatusMu.Lock()
	s.versionStatus = status
	s.versionStatusErr = ""
	s.versionStatusMu.Unlock()
	return nil
}

func (s *Server) ensureVersionStatus() {
	s.versionStatusMu.RLock()
	initialized := s.versionStatus != nil
	s.versionStatusMu.RUnlock()
	if initialized {
		return
	}

	if err := s.refreshVersionStatus(); err != nil {
		log.Printf("Failed to retrieve version information: %v", err)
	}
}

func (s *Server) versionStatusSnapshot() (*VersionStatus, string) {
	s.versionStatusMu.RLock()
	defer s.versionStatusMu.RUnlock()

	errMsg := s.versionStatusErr
	if s.versionStatus == nil {
		return nil, errMsg
	}

	copyStatus := *s.versionStatus
	copyStatus.GoClient = s.versionStatus.GoClient
	copyStatus.ChromeExtension = s.versionStatus.ChromeExtension
	return &copyStatus, errMsg
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

	if err := s.refreshVersionStatus(); err != nil {
		log.Printf("Initial version check failed: %v", err)
	}

	log.Printf("Web server starting on port %s", s.port)

	listenAddr := net.JoinHostPort(constants.LocalhostAddress, s.port)

	// Auto-open browser
	go s.openBrowser()

	return http.ListenAndServe(listenAddr, mux)
}

func (s *Server) openBrowser() {
	url := fmt.Sprintf("http://%s:%s", constants.LocalhostAddress, s.port)

	err := s.browserOpener.Open(url)
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

	s.ensureVersionStatus()
	if status, errMsg := s.versionStatusSnapshot(); status != nil {
		data.VersionStatus = status
		data.VersionError = ""
	} else if errMsg != "" {
		data.VersionError = errMsg
	}

	log.Printf("Rendering home page with %d guilds, token: %v", len(data.Guilds), data.Token != "")

	// Set proper content type
	w.Header().Set("Content-Type", constants.ContentTypeHTML)

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
	w.Header().Set("Content-Type", constants.ContentTypeHTML)

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

	if !s.verifyLocalRequest(w, r) {
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

	botToken := strings.TrimSpace(s.getBotToken())
	if botToken == "" {
		fetchedToken, err := s.authClient.GetBotToken(s.tokenData.Token)
		if err != nil {
			log.Printf("Failed to get bot token: %v", err)
			response := map[string]interface{}{
				"success": false,
				"message": "Failed to get bot token from server",
			}
			w.Header().Set("Content-Type", constants.ContentTypeJSON)
			json.NewEncoder(w).Encode(response)
			return
		}
		botToken = fetchedToken
	}

	// Connect to Discord voice channel
	err = s.streamer.Connect(botToken, req.GuildID, req.ChannelID)
	if err != nil {
		log.Printf("Failed to connect to Discord: %v", err)
		response := map[string]interface{}{
			"success": false,
			"message": fmt.Sprintf("Failed to connect: %v", err),
		}
		w.Header().Set("Content-Type", constants.ContentTypeJSON)
		json.NewEncoder(w).Encode(response)
		return
	}

	log.Printf("Successfully connected to Discord voice channel %s in guild %s", req.ChannelID, req.GuildID)

	response := map[string]interface{}{
		"success": true,
		"message": "Connected to Discord voice channel",
	}

	w.Header().Set("Content-Type", constants.ContentTypeJSON)
	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleDisconnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !s.verifyLocalRequest(w, r) {
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
		w.Header().Set("Content-Type", constants.ContentTypeJSON)
		json.NewEncoder(w).Encode(response)
		return
	}

	log.Printf("Successfully disconnected from Discord")

	response := map[string]interface{}{
		"success": true,
		"message": "Disconnected from Discord",
	}

	w.Header().Set("Content-Type", constants.ContentTypeJSON)
	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	s.ensureVersionStatus()
	// Check WebSocket connection from Chrome extension
	chromeConnected := false
	chromeStreaming := false
	if s.wsServer != nil {
		chromeConnected = s.wsServer.IsConnected()
		chromeStreaming = s.wsServer.IsStreaming()
	}

	// Check Discord connection
	discordConnected := s.streamer.IsConnected()

	status := map[string]interface{}{
		"connected":        discordConnected,                    // Discord voice connection
		"chromeConnected":  chromeConnected,                     // Chrome extension WebSocket connection
		"streaming":        chromeStreaming && discordConnected, // Both must be true for actual streaming
		"authenticated":    s.tokenData != nil,
		"discordConnected": discordConnected, // Explicit Discord status
		"wsConnected":      chromeConnected,  // Explicit WebSocket status
	}
	status["clientVersion"] = constants.ApplicationVersion

	if versionStatus, errMsg := s.versionStatusSnapshot(); versionStatus != nil {
		status["updates"] = versionStatus
	} else if errMsg != "" {
		status["updateError"] = errMsg
	}

	if s.tokenData != nil {
		status["guilds"] = s.tokenData.Guilds
	}

	if discordConnected {
		status["currentGuild"] = s.streamer.GetGuildID()
		status["currentChannel"] = s.streamer.GetChannelID()
	}

	w.Header().Set("Content-Type", constants.ContentTypeJSON)
	json.NewEncoder(w).Encode(status)
}

func (s *Server) handleChannels(w http.ResponseWriter, r *http.Request) {
	if s.tokenData == nil {
		http.Error(w, "Not authenticated", http.StatusUnauthorized)
		return
	}

	if !s.verifyLocalRequest(w, r) {
		return
	}

	// Extract guild ID from URL path
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}
	guildID := pathParts[3]

	channels, err := s.authClient.GetChannels(guildID, s.tokenData.Token)
	if err != nil {
		log.Printf("Failed to get channels for guild %s: %v", guildID, err)
		http.Error(w, "Failed to get channels", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"channels": channels,
	}

	w.Header().Set("Content-Type", constants.ContentTypeJSON)
	json.NewEncoder(w).Encode(response)
}

func buildComponentUpdate(name, current string, remote auth.VersionComponent) ComponentUpdate {
	latest := strings.TrimSpace(remote.LatestVersion)
	if latest == "" {
		latest = current
	}

	minimum := strings.TrimSpace(remote.MinimumVersion)
	if minimum == "" {
		minimum = latest
	}

	downloadURL := strings.TrimSpace(remote.DownloadURL)
	releaseNotes := strings.TrimSpace(remote.ReleaseNotes)

	updateRequired := compareVersions(current, minimum) < 0
	updateRecommended := compareVersions(current, latest) < 0

	return ComponentUpdate{
		Name:              name,
		CurrentVersion:    current,
		LatestVersion:     latest,
		MinimumVersion:    minimum,
		DownloadURL:       downloadURL,
		ReleaseNotes:      releaseNotes,
		UpdateRequired:    updateRequired,
		UpdateRecommended: updateRecommended,
	}
}

func compareVersions(a, b string) int {
	parse := func(v string) []int {
		v = strings.TrimSpace(v)
		if v == "" {
			return []int{0}
		}
		parts := strings.Split(v, ".")
		result := make([]int, len(parts))
		for i, part := range parts {
			value, err := strconv.Atoi(part)
			if err != nil {
				value = 0
			}
			result[i] = value
		}
		return result
	}

	pa := parse(a)
	pb := parse(b)
	maxLen := len(pa)
	if len(pb) > maxLen {
		maxLen = len(pb)
	}

	for i := 0; i < maxLen; i++ {
		var ai, bi int
		if i < len(pa) {
			ai = pa[i]
		}
		if i < len(pb) {
			bi = pb[i]
		}
		if ai < bi {
			return -1
		}
		if ai > bi {
			return 1
		}
	}

	return 0
}

func (s *Server) getBotToken() string {
	if s.config == nil {
		return ""
	}
	return s.config.DiscordBotToken
}

func (s *Server) verifyLocalRequest(w http.ResponseWriter, r *http.Request) bool {
	allowedHosts := map[string]struct{}{
		constants.LocalhostAddress: {},
		"127.0.0.1":                {},
		"::1":                      {},
	}

	validate := func(value string) bool {
		if value == "" {
			return true
		}
		parsed, err := url.Parse(value)
		if err != nil {
			return false
		}
		host := parsed.Hostname()
		port := parsed.Port()
		if port == "" {
			port = s.port
		}
		_, ok := allowedHosts[host]
		return ok && port == s.port
	}

	origin := r.Header.Get("Origin")
	if origin != "" && !validate(origin) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return false
	}

	referer := r.Header.Get("Referer")
	if origin == "" && referer != "" && !validate(referer) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return false
	}
	return true
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
