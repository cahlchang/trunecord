package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"trunecord/internal/auth"
	"trunecord/internal/config"
	"trunecord/internal/discord"
	"trunecord/internal/websocket"
)

type App struct {
	config     *config.Config
	streamer   *discord.Streamer
	wsServer   *websocket.Server
	authClient *auth.Client
	userToken  string
}

func (a *App) run() {
	// Start WebSocket server for Chrome extension
	go func() {
		log.Printf("📡 Starting WebSocket server on port %s", a.config.WebSocketPort)
		if err := a.wsServer.Start(a.config.WebSocketPort); err != nil {
			log.Printf("WebSocket server error: %v", err)
		}
	}()
	
	// Connect WebSocket audio buffer to Discord streamer
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		
		for range ticker.C {
			if a.streamer.IsConnected() && !a.streamer.IsStreaming() {
				// Start streaming with WebSocket audio buffer
				err := a.streamer.StartStreaming(a.wsServer.GetAudioChannel())
				if err != nil {
					log.Printf("Failed to start streaming: %v", err)
					continue
				}
				log.Printf("🎤 Started streaming audio to Discord")
			}
		}
	}()

	// Start HTTP server for OAuth callback and web UI
	go a.startHTTPServer()

	// Open browser after a short delay to ensure server is ready
	go func() {
		time.Sleep(1 * time.Second) // Reduce delay for faster startup
		a.openBrowser()
	}()

	// Print status
	fmt.Println("")
	fmt.Println("✅ App is running!")
	fmt.Println("")
	fmt.Printf("🌐 Web Interface: http://localhost:%s\n", a.config.WebPort)
	fmt.Printf("📡 WebSocket Port: %s (for Chrome Extension)\n", a.config.WebSocketPort)
	fmt.Println("")
	fmt.Println("Press Ctrl+C to stop")
	fmt.Println("")

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	fmt.Println("")
	log.Println("👋 Shutting down...")
	if a.streamer.IsConnected() {
		a.streamer.Disconnect()
	}
}

func main() {
	// Set up logging to file when running as .app bundle
	homeDir, _ := os.UserHomeDir()
	logPath := filepath.Join(homeDir, "Library", "Logs", "trunecord.log")
	
	// Create log directory if it doesn't exist
	os.MkdirAll(filepath.Dir(logPath), 0755)
	
	// Open log file
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err == nil {
		// Set both stdout and log file as outputs
		multiWriter := io.MultiWriter(os.Stdout, logFile)
		log.SetOutput(multiWriter)
		defer logFile.Close()
	}
	
	// Load configuration first
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize app temporarily for checkExistingInstance
	tempApp := &App{config: cfg}
	
	// Check for existing instance
	if tempApp.checkExistingInstance() {
		log.Println("⚠️ trunecord is already running")
		showNotification("trunecord", "アプリケーションは既に起動しています")
		// Bring existing browser window to front
		bringBrowserToFront(cfg.WebPort)
		os.Exit(0)
	}
	
	fmt.Println("")
	fmt.Println("=====================================")
	fmt.Println("     🎵 trunecord Music Streamer")
	fmt.Println("=====================================")
	fmt.Println("")
	log.Println("🚀 Starting trunecord...")

	// Initialize app (config already loaded)
	app := &App{
		config:     cfg,
		authClient: auth.NewClient(cfg.AuthAPIURL),
		streamer:   discord.NewStreamer(),
		wsServer:   websocket.NewServer(),
	}

	// Run the application
	app.run()
}

func (a *App) startHTTPServer() {
	mux := http.NewServeMux()

	// Serve static files
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			a.serveHomePage(w, r)
		} else {
			http.NotFound(w, r)
		}
	})

	// Handle OAuth callback
	mux.HandleFunc("/auth/callback", a.handleAuthCallback)

	// API endpoints
	mux.HandleFunc("/api/auth-url", a.handleGetAuthURL)
	mux.HandleFunc("/api/guilds", a.handleGetGuilds)
	mux.HandleFunc("/api/channels", a.handleGetChannels)
	mux.HandleFunc("/api/connect", a.handleConnect)
	mux.HandleFunc("/api/disconnect", a.handleDisconnect)
	mux.HandleFunc("/api/status", a.handleStatus)

	server := &http.Server{
		Addr:         ":" + a.config.WebPort,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	
	log.Printf("Starting HTTP server on http://localhost:%s", a.config.WebPort)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("HTTP server error: %v", err)
	}
}

func (a *App) serveHomePage(w http.ResponseWriter, r *http.Request) {
	html := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>trunecord - Stream YouTube Music to Discord</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 2rem;
            width: 100%;
            max-width: 500px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        h1 {
            text-align: center;
            margin-bottom: 2rem;
            font-size: 2rem;
        }
        .section {
            margin-bottom: 2rem;
        }
        .section h2 {
            margin-bottom: 1rem;
            font-size: 1.2rem;
            opacity: 0.9;
        }
        .status {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            margin-bottom: 1rem;
        }
        .status-value {
            font-weight: bold;
        }
        .connected { color: #57f287; }
        .disconnected { color: #ed4245; }
        select, button {
            width: 100%;
            padding: 0.8rem;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            margin-bottom: 1rem;
            cursor: pointer;
        }
        select {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }
        select option {
            background: #5865f2;
            color: white;
        }
        button {
            background: #5865f2;
            color: white;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        button:hover:not(:disabled) {
            background: #4752c4;
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .auth-btn { background: #7289da; }
        .auth-btn:hover:not(:disabled) { background: #5b6eae; }
        .connect-btn { background: #57f287; color: #1a1a1a; }
        .connect-btn:hover:not(:disabled) { background: #47d272; }
        .disconnect-btn { background: #ed4245; }
        .disconnect-btn:hover:not(:disabled) { background: #d83c3f; }
        .logout-btn { 
            background: #6c757d; 
            margin-top: 2rem;
        }
        .logout-btn:hover:not(:disabled) { background: #5a6268; }
        .user-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 1rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            margin-bottom: 1rem;
            font-size: 0.9rem;
        }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎵 trunecord</h1>
        
        <div id="auth-section" class="section">
            <h2>Authentication</h2>
            <button id="auth-btn" class="auth-btn" onclick="authenticate()">
                Connect with Discord
            </button>
        </div>

        <div id="control-section" class="section hidden">
            <div id="user-info" class="user-info hidden">
                <span>Logged in as: <strong id="username"></strong></span>
            </div>
            
            <h2>Status</h2>
            <div class="status">
                <span>Discord Connection:</span>
                <span id="connection-status" class="status-value disconnected">Disconnected</span>
            </div>
            <div class="status">
                <span>Audio Streaming:</span>
                <span id="streaming-status" class="status-value disconnected">Stopped</span>
            </div>

            <h2>Server Selection</h2>
            <select id="guild-select" onchange="onGuildChange()">
                <option value="">Choose a server...</option>
            </select>
            <select id="channel-select" onchange="onChannelChange()">
                <option value="">Choose a voice channel...</option>
            </select>
            <button id="connect-btn" class="connect-btn" onclick="connect()" disabled>
                Connect to Voice Channel
            </button>
            <button id="disconnect-btn" class="disconnect-btn hidden" onclick="disconnect()">
                Disconnect
            </button>
            
            <button id="logout-btn" class="logout-btn" onclick="logout()">
                Logout
            </button>
        </div>
    </div>

    <script>
        let authenticated = false;
        let connected = false;
        let streaming = false;
        let currentUser = null;

        // Check authentication on load
        checkAuth();
        setInterval(updateStatus, 2000);

        async function checkAuth() {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');
            
            if (token) {
                // New token from OAuth callback
                console.log('New token received from OAuth callback');
                localStorage.setItem('token', token);
                // Extract user info from JWT token
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    currentUser = payload.username || payload.userId;
                    localStorage.setItem('username', currentUser);
                } catch (e) {
                    console.error('Failed to decode token:', e);
                }
                window.history.replaceState({}, document.title, '/');
                authenticated = true;
                showControlSection();
                // Wait for DOM to update before loading guilds
                setTimeout(async () => {
                    console.log('Delayed loadGuilds call...');
                    await loadGuilds();
                }, 500); // Increase delay to ensure DOM is ready
            } else if (localStorage.getItem('token')) {
                // Verify the stored token is still valid
                console.log('Existing token found, verifying...');
                currentUser = localStorage.getItem('username');
                try {
                    const response = await fetch('/api/guilds', {
                        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
                    });
                    if (response.ok) {
                        const guilds = await response.json();
                        console.log('Token valid, guilds count:', guilds.length);
                        authenticated = true;
                        showControlSection();
                        // Populate guilds directly since we already have them
                        const select = document.getElementById('guild-select');
                        select.innerHTML = '<option value="">Choose a server...</option>';
                        guilds.forEach(guild => {
                            const option = document.createElement('option');
                            option.value = guild.id;
                            option.textContent = guild.name;
                            select.appendChild(option);
                        });
                    } else {
                        // Token is invalid, clear it and show auth section
                        console.log('Token invalid, status:', response.status);
                        localStorage.removeItem('token');
                        localStorage.removeItem('username');
                        showAuthSection();
                    }
                } catch (err) {
                    console.error('Auth check failed:', err);
                    localStorage.removeItem('token');
                    localStorage.removeItem('username');
                    showAuthSection();
                }
            } else {
                // No token, show auth section
                showAuthSection();
            }
        }

        async function authenticate() {
            const response = await fetch('/api/auth-url');
            const data = await response.json();
            window.location.href = data.url;
        }

        function showAuthSection() {
            document.getElementById('auth-section').classList.remove('hidden');
            document.getElementById('control-section').classList.add('hidden');
        }
        
        function showControlSection() {
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('control-section').classList.remove('hidden');
            // Show user info if available
            if (currentUser) {
                document.getElementById('user-info').classList.remove('hidden');
                document.getElementById('username').textContent = currentUser;
            }
        }

        async function loadGuilds() {
            try {
                console.log('Loading guilds...');
                const token = localStorage.getItem('token');
                if (!token) {
                    console.error('No token found');
                    return;
                }
                
                // Small delay to ensure token is settled
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const headers = { 'Authorization': 'Bearer ' + token };
                const response = await fetch('/api/guilds', { headers });
                if (!response.ok) {
                    console.error('Failed to load guilds:', response.status);
                    return;
                }
                const guilds = await response.json();
                console.log('Guilds loaded:', guilds.length);
                
                // Double-check the select element exists
                let select = document.getElementById('guild-select');
                if (!select) {
                    console.error('Guild select element not found, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 200));
                    select = document.getElementById('guild-select');
                    if (!select) {
                        console.error('Guild select element still not found');
                        return;
                    }
                }
                
                select.innerHTML = '<option value="">Choose a server...</option>';
                guilds.forEach(guild => {
                    const option = document.createElement('option');
                    option.value = guild.id;
                    option.textContent = guild.name;
                    select.appendChild(option);
                });
                console.log('Guilds added to dropdown:', guilds.map(g => g.name).join(', '));
            } catch (err) {
                console.error('Error loading guilds:', err);
                // Retry once after a delay
                console.log('Retrying loadGuilds after delay...');
                setTimeout(async () => {
                    try {
                        await loadGuilds();
                    } catch (retryErr) {
                        console.error('Retry failed:', retryErr);
                    }
                }, 1000);
            }
        }

        async function onGuildChange() {
            const guildId = document.getElementById('guild-select').value;
            if (!guildId) return;
            
            const token = localStorage.getItem('token');
            const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
            const params = new URLSearchParams({ guildId });
            const response = await fetch('/api/channels?' + params.toString(), { headers });
            const channels = await response.json();
            const select = document.getElementById('channel-select');
            select.innerHTML = '<option value="">Choose a voice channel...</option>';
            channels.forEach(channel => {
                const option = document.createElement('option');
                option.value = channel.id;
                option.textContent = channel.name;
                select.appendChild(option);
            });
        }

        function onChannelChange() {
            const channelId = document.getElementById('channel-select').value;
            document.getElementById('connect-btn').disabled = !channelId;
        }

        async function connect() {
            const guildId = document.getElementById('guild-select').value;
            const channelId = document.getElementById('channel-select').value;
            const token = localStorage.getItem('token');
            
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;
            
            await fetch('/api/connect', {
                method: 'POST',
                headers,
                body: JSON.stringify({ guildId, channelId })
            });
            
            connected = true;
            updateUI();
        }

        async function disconnect() {
            await fetch('/api/disconnect', { method: 'POST' });
            connected = false;
            updateUI();
        }

        async function updateStatus() {
            const response = await fetch('/api/status');
            const status = await response.json();
            connected = status.connected;
            streaming = status.streaming;
            updateUI();
        }

        function updateUI() {
            const connectionStatus = document.getElementById('connection-status');
            const streamingStatus = document.getElementById('streaming-status');
            const connectBtn = document.getElementById('connect-btn');
            const disconnectBtn = document.getElementById('disconnect-btn');
            
            if (connectionStatus) {
                connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
                connectionStatus.className = 'status-value ' + (connected ? 'connected' : 'disconnected');
            }
            
            if (streamingStatus) {
                streamingStatus.textContent = streaming ? 'Streaming' : 'Stopped';
                streamingStatus.className = 'status-value ' + (streaming ? 'connected' : 'disconnected');
            }
            
            if (connectBtn && disconnectBtn) {
                connectBtn.classList.toggle('hidden', connected);
                disconnectBtn.classList.toggle('hidden', !connected);
            }
        }
        
        async function logout() {
            // Disconnect if connected
            if (connected) {
                await disconnect();
            }
            
            // Clear authentication data
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            currentUser = null;
            authenticated = false;
            
            // Reset UI
            document.getElementById('guild-select').innerHTML = '<option value="">Choose a server...</option>';
            document.getElementById('channel-select').innerHTML = '<option value="">Choose a voice channel...</option>';
            
            // Show auth section
            showAuthSection();
            
            console.log('Logged out successfully');
        }
    </script>
</body>
</html>`
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(html))
}

func (a *App) handleAuthCallback(w http.ResponseWriter, r *http.Request) {
	if a.authClient == nil {
		http.Error(w, "Authentication client not initialized", http.StatusInternalServerError)
		return
	}
	
	// Only allow GET requests for callbacks
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	token := r.URL.Query().Get("token")
	errorParam := r.URL.Query().Get("error")
	
	// Handle OAuth errors
	if errorParam != "" {
		log.Printf("OAuth error received: %s", errorParam)
		http.Error(w, "Authentication failed", http.StatusUnauthorized)
		return
	}
	
	// Validate token presence and format
	if token == "" {
		log.Printf("No token received in callback")
		http.Error(w, "Invalid callback - no token", http.StatusBadRequest)
		return
	}
	
	// Basic token format validation (JWT should have 3 parts separated by dots)
	tokenParts := strings.Split(token, ".")
	if len(tokenParts) != 3 {
		log.Printf("Invalid token format received")
		http.Error(w, "Invalid token format", http.StatusBadRequest)
		return
	}

	// Verify token is actually valid by testing it with the auth server
	valid, err := a.authClient.VerifyToken(token)
	if err != nil {
		log.Printf("Token verification failed: %v", err)
		http.Error(w, "Token verification failed", http.StatusUnauthorized)
		return
	}
	if !valid {
		log.Printf("Token verification returned invalid")
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	// Store token and set secure cookie
	a.userToken = token
	log.Printf("Authentication successful and token verified")
	
	// Set HttpOnly cookie for security
	cookie := &http.Cookie{
		Name:     "auth_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: http.SameSiteLaxMode,
		MaxAge:   86400, // 24 hours
	}
	http.SetCookie(w, cookie)

	// Redirect to home without token in URL
	http.Redirect(w, r, "/", http.StatusFound)
}

func (a *App) handleGetAuthURL(w http.ResponseWriter, r *http.Request) {
	url := a.authClient.GetAuthURL()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"url": url})
}

func (a *App) handleGetGuilds(w http.ResponseWriter, r *http.Request) {
	// Get token from Authorization header, cookie, or use stored token
	token := a.userToken
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		token = strings.TrimPrefix(authHeader, "Bearer ")
	} else if cookie, err := r.Cookie("auth_token"); err == nil {
		token = cookie.Value
	}
	
	if token == "" {
		http.Error(w, "Not authenticated", http.StatusUnauthorized)
		return
	}
	
	guilds, err := a.authClient.GetGuilds(token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(guilds)
}

func (a *App) handleGetChannels(w http.ResponseWriter, r *http.Request) {
	guildID := strings.TrimSpace(r.URL.Query().Get("guildId"))
	
	// Validate guildID parameter
	if guildID == "" {
		http.Error(w, "Missing guildId parameter", http.StatusBadRequest)
		return
	}
	
	// Get token from Authorization header, cookie, or use stored token
	token := a.userToken
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		token = strings.TrimPrefix(authHeader, "Bearer ")
	} else if cookie, err := r.Cookie("auth_token"); err == nil {
		token = cookie.Value
	}
	
	if token == "" {
		http.Error(w, "Not authenticated", http.StatusUnauthorized)
		return
	}
	
	channels, err := a.authClient.GetChannels(guildID, token)
	if err != nil {
		log.Printf("Failed to get channels for guild %s: %v", guildID, err)
		if strings.Contains(err.Error(), "invalid guildID format") {
			http.Error(w, "Invalid guild ID format", http.StatusBadRequest)
		} else {
			http.Error(w, "Failed to get channels", http.StatusInternalServerError)
		}
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(channels)
}

func (a *App) handleConnect(w http.ResponseWriter, r *http.Request) {
	if a.authClient == nil {
		http.Error(w, "Authentication client not initialized", http.StatusInternalServerError)
		return
	}
	
	// Only allow POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var req struct {
		GuildID   string `json:"guildId"`
		ChannelID string `json:"channelId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Failed to decode connect request: %v", err)
		http.Error(w, "Invalid request format", http.StatusBadRequest)
		return
	}
	
	// Validate input parameters
	req.GuildID = strings.TrimSpace(req.GuildID)
	req.ChannelID = strings.TrimSpace(req.ChannelID)
	
	if req.GuildID == "" || req.ChannelID == "" {
		http.Error(w, "Missing guildId or channelId", http.StatusBadRequest)
		return
	}
	
	// Basic Discord ID format validation
	if !isValidDiscordID(req.GuildID) || !isValidDiscordID(req.ChannelID) {
		http.Error(w, "Invalid guild or channel ID format", http.StatusBadRequest)
		return
	}

	// Get token from Authorization header, cookie, or use stored token
	token := a.userToken
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		token = strings.TrimPrefix(authHeader, "Bearer ")
	} else if cookie, err := r.Cookie("auth_token"); err == nil {
		token = cookie.Value
	}
	
	if token == "" {
		http.Error(w, "Not authenticated", http.StatusUnauthorized)
		return
	}

	// Get bot token
	botToken, err := a.authClient.GetBotToken(token)
	if err != nil {
		log.Printf("Failed to get bot token: %v", err)
		http.Error(w, "Failed to get bot token", http.StatusInternalServerError)
		return
	}

	// Connect to Discord
	if err := a.streamer.Connect(botToken, req.GuildID, req.ChannelID); err != nil {
		log.Printf("Failed to connect to Discord: %v", err)
		http.Error(w, "Failed to connect to Discord voice channel", http.StatusInternalServerError)
		return
	}
	
	// Start streaming audio from WebSocket to Discord
	if !a.streamer.IsStreaming() {
		err := a.streamer.StartStreaming(a.wsServer.GetAudioChannel())
		if err != nil {
			log.Printf("Failed to start streaming: %v", err)
		} else {
			log.Printf("🎤 Started streaming audio to Discord")
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// Helper function to validate Discord ID format (duplicate from auth package for main package)
func isValidDiscordID(id string) bool {
	// Discord IDs are 64-bit unsigned integers (up to 19 digits)
	if len(id) < 1 || len(id) > 19 {
		return false
	}
	for _, char := range id {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}

func (a *App) handleDisconnect(w http.ResponseWriter, r *http.Request) {
	// Only allow POST requests for disconnect
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	if a.streamer != nil && a.streamer.IsConnected() {
		err := a.streamer.Disconnect()
		if err != nil {
			log.Printf("Error during disconnect: %v", err)
		} else {
			log.Printf("Successfully disconnected from Discord")
		}
	}
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func (a *App) handleStatus(w http.ResponseWriter, r *http.Request) {
	discordStreaming := false
	if a.streamer != nil {
		discordStreaming = a.streamer.IsConnected() && a.streamer.IsStreaming()
	}
	
	status := map[string]interface{}{
		"connected":        a.streamer.IsConnected(),
		"streaming":        a.wsServer.IsStreaming(),
		"discordStreaming": discordStreaming,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func (a *App) checkExistingInstance() bool {
	// Check if configured web port is already in use
	conn, err := net.Dial("tcp", "localhost:"+a.config.WebPort)
	if err != nil {
		// Port is not in use, no existing instance
		return false
	}
	defer conn.Close()
	// Port is in use, existing instance found
	return true
}

func showNotification(title, message string) {
	switch runtime.GOOS {
	case "darwin":
		// Use osascript to show notification on macOS
		script := fmt.Sprintf(`display notification "%s" with title "%s" sound name "Blow"`, message, title)
		cmd := exec.Command("osascript", "-e", script)
		err := cmd.Run()
		if err != nil {
			// Fallback to terminal-notifier if available
			cmd = exec.Command("terminal-notifier", "-title", title, "-message", message, "-sound", "default")
			err = cmd.Run()
			if err != nil {
				log.Printf("Failed to show notification: %v", err)
			}
		}
	case "windows":
		// On Windows, log to console (notifications require additional dependencies)
		log.Printf("NOTIFICATION - %s: %s", title, message)
	case "linux":
		// On Linux, try notify-send if available
		cmd := exec.Command("notify-send", title, message)
		err := cmd.Run()
		if err != nil {
			// Fallback to console log
			log.Printf("NOTIFICATION - %s: %s", title, message)
		}
	default:
		// Default to console log
		log.Printf("NOTIFICATION - %s: %s", title, message)
	}
}

func bringBrowserToFront(port string) {
	url := "http://localhost:" + port
	
	switch runtime.GOOS {
	case "darwin":
		// First, get the default browser
		defaultBrowser := getDefaultBrowser()
		log.Printf("🌐 Default browser: %s", defaultBrowser)
		
		// Try to activate the default browser with the URL
		var script string
		
		switch defaultBrowser {
		case "Safari", "Safari.app":
			script = fmt.Sprintf(`
				tell application "Safari"
					activate
					set found to false
					repeat with w in windows
						repeat with t in tabs of w
							if URL of t starts with "%s" then
								set current tab of w to t
								set index of w to 1
								set found to true
								exit repeat
							end if
						end repeat
						if found then exit repeat
					end repeat
					if not found then
						open location "%s"
					end if
				end tell
			`, url, url)
			
		case "Google Chrome", "Google Chrome.app":
			script = fmt.Sprintf(`
				tell application "Google Chrome"
					activate
					set found to false
					repeat with w in windows
						set tabIndex to 0
						repeat with t in tabs of w
							set tabIndex to tabIndex + 1
							if URL of t starts with "%s" then
								set active tab index of w to tabIndex
								set index of w to 1
								set found to true
								exit repeat
							end if
						end repeat
						if found then exit repeat
					end repeat
					if not found then
						open location "%s"
					end if
				end tell
			`, url, url)
			
		case "Arc", "Arc.app":
			script = fmt.Sprintf(`
				tell application "Arc"
					activate
					open location "%s"
				end tell
			`, url)
			
		case "Firefox", "Firefox.app":
			script = fmt.Sprintf(`
				tell application "Firefox"
					activate
					open location "%s"
				end tell
			`, url)
			
		case "Microsoft Edge", "Microsoft Edge.app":
			script = fmt.Sprintf(`
				tell application "Microsoft Edge"
					activate
					open location "%s"
				end tell
			`, url)
			
		default:
			// For unknown browsers, just try to open the URL
			script = fmt.Sprintf(`open location "%s"`, url)
		}
		
		if script != "" {
			cmd := exec.Command("osascript", "-e", script)
			err := cmd.Run()
			if err == nil {
				log.Println("🔄 Brought existing browser window to front")
				return
			}
		}
		
		// Fallback: just open the URL with system default
		cmd := exec.Command("open", url)
		err := cmd.Run()
		if err != nil {
			log.Printf("Failed to open browser: %v", err)
		}
		
	case "linux":
		// On Linux, just open the URL which should focus the existing tab
		cmd := exec.Command("xdg-open", url)
		err := cmd.Run()
		if err != nil {
			log.Printf("Failed to open browser: %v", err)
		}
		
	case "windows":
		// On Windows, opening the URL should bring the browser to front
		cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
		err := cmd.Run()
		if err != nil {
			log.Printf("Failed to open browser: %v", err)
		}
	}
}

func getDefaultBrowser() string {
	// Get the default browser on macOS
	cmd := exec.Command("defaults", "read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers")
	output, err := cmd.Output()
	if err == nil {
		// Parse the output to find the default browser for http/https
		lines := strings.Split(string(output), "\n")
		for i, line := range lines {
			if strings.Contains(line, "LSHandlerURLScheme = https") || strings.Contains(line, "LSHandlerURLScheme = http") {
				// Look for the bundle identifier in the next few lines
				for j := i; j < len(lines) && j < i+5; j++ {
					if strings.Contains(lines[j], "LSHandlerRoleAll") {
						// Extract bundle ID
						parts := strings.Split(lines[j], "=")
						if len(parts) >= 2 {
							bundleID := strings.TrimSpace(parts[1])
							bundleID = strings.Trim(bundleID, ";")
							bundleID = strings.Trim(bundleID, `"`)
							// Map bundle ID to app name
							switch bundleID {
							case "com.apple.Safari":
								return "Safari"
							case "com.google.Chrome":
								return "Google Chrome"
							case "company.thebrowser.Browser":
								return "Arc"
							case "org.mozilla.firefox":
								return "Firefox"
							case "com.microsoft.edgemac":
								return "Microsoft Edge"
							}
						}
					}
				}
			}
		}
	}
	
	// Fallback: try a simpler method
	cmd = exec.Command("osascript", "-e", `tell application "System Events" to get name of first application process whose frontmost is true`)
	if output, err := cmd.Output(); err == nil {
		return strings.TrimSpace(string(output))
	}
	
	// Default to Safari if we can't determine
	return "Safari"
}

func (a *App) openBrowser() {
	url := fmt.Sprintf("http://localhost:%s", a.config.WebPort)
	var err error

	log.Printf("🌐 Attempting to open browser at %s", url)

	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		// Use the system default browser
		cmd := exec.Command("open", url)
		err = cmd.Run()
		
		if err != nil {
			// Fallback: Use osascript to open URL
			script := fmt.Sprintf(`open location "%s"`, url)
			cmd = exec.Command("osascript", "-e", script)
			err = cmd.Run()
		}
	default:
		log.Printf("Please open %s in your browser", url)
		return
	}

	if err != nil {
		log.Printf("❌ Failed to open browser: %v", err)
		log.Printf("📌 Please manually open: %s", url)
		log.Printf("📌 The app is running and waiting for connections")
	} else {
		log.Printf("✅ Browser opened successfully")
	}
}