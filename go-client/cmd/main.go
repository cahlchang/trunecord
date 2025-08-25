package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"trunecord/internal/auth"
	"trunecord/internal/config"
	"trunecord/internal/discord"
	"trunecord/internal/websocket"
)

//go:embed ../web
var assets embed.FS

// App struct for Wails
type App struct {
	ctx        context.Context
	config     *config.Config
	streamer   *discord.Streamer
	wsServer   *websocket.Server
	authClient *auth.Client
	userToken  string  // User's auth token from OAuth
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	// Save context for later use
	a.ctx = ctx
	
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize components
	a.config = cfg
	a.authClient = auth.NewClient(cfg.AuthAPIURL)
	a.streamer = discord.NewStreamer()
	a.wsServer = websocket.NewServer()

	// Start WebSocket server for Chrome extension
	go func() {
		log.Printf("Starting WebSocket server on port %s", cfg.WebSocketPort)
		if err := a.wsServer.Start(cfg.WebSocketPort); err != nil {
			log.Printf("WebSocket server error: %v", err)
		}
	}()
	
	// Start HTTP server for authentication callback
	go func() {
		log.Printf("Starting HTTP server on port %s", cfg.WebPort)
		a.startHTTPServer()
	}()
	
	// Protocol URL handling is now done only via onSecondInstance or manual authentication
	// This ensures the app shows authentication screen on initial startup
	log.Printf("[Startup] Initial startup completed. User needs to authenticate manually.")
}

// GetStatus returns the current status
func (a *App) GetStatus() map[string]interface{} {
	discordStreaming := false
	if a.streamer != nil {
		discordStreaming = a.streamer.IsConnected() && a.streamer.IsStreaming()
	}
	
	return map[string]interface{}{
		"connected":        a.streamer.IsConnected(),
		"streaming":        a.wsServer.IsStreaming(),
		"discordStreaming": discordStreaming,
		"wsPort":           a.config.WebSocketPort,
		"webPort":          a.config.WebPort,
	}
}

// GetAuthURL returns the auth URL for Discord OAuth with custom protocol redirect
func (a *App) GetAuthURL() string {
	if a.authClient == nil {
		return ""
	}
	
	// Get the base auth URL (already includes ?redirect_protocol=trunecord)
	finalURL := a.authClient.GetAuthURL()
	
	log.Printf("Auth URL generated: %s", finalURL)
	return finalURL
}

// HandleAuthCallback processes the OAuth callback and stores the user token
func (a *App) HandleAuthCallback(callbackURL string) error {
	if strings.TrimSpace(callbackURL) == "" {
		return fmt.Errorf("callbackURL cannot be empty")
	}
	
	tokenData, err := a.authClient.ParseAuthCallback(callbackURL)
	if err != nil {
		return fmt.Errorf("failed to parse auth callback: %v", err)
	}
	
	// Store the user token for later use
	a.userToken = tokenData.Token
	
	log.Printf("Successfully authenticated")
	
	// Emit event to frontend to notify authentication success
	if a.ctx != nil {
		if err := runtime.EventsEmit(a.ctx, "auth:success", map[string]interface{}{
			"authenticated": true,
		}); err != nil {
			log.Printf("Failed to emit auth:success event: %v", err)
		}
	}
	
	return nil
}

// HandleProtocol handles custom protocol URLs (trunecord://)
func (a *App) HandleProtocol(protocolURL string) error {
	log.Printf("[HandleProtocol] Received URL: %s", protocolURL)
	
	// Check if it's a trunecord:// URL
	if !strings.HasPrefix(protocolURL, "trunecord://") {
		return fmt.Errorf("invalid protocol URL: must start with trunecord://")
	}
	
	// Remove the protocol prefix
	urlPath := strings.TrimPrefix(protocolURL, "trunecord://")
	log.Printf("[HandleProtocol] URL path: %s", urlPath)
	
	// Handle different paths
	if strings.HasPrefix(urlPath, "auth/callback") {
		// Extract query parameters
		parts := strings.SplitN(urlPath, "?", 2)
		if len(parts) != 2 {
			return fmt.Errorf("invalid auth callback URL: missing parameters")
		}
		
		log.Printf("[HandleProtocol] Query params: %s", parts[1])
		
		// Parse as regular HTTP URL to extract parameters
		fullURL := "http://dummy/?" + parts[1]
		return a.HandleAuthCallback(fullURL)
	} else if strings.HasPrefix(urlPath, "auth/error") {
		// Handle OAuth error
		return fmt.Errorf("authentication failed")
	}
	
	return fmt.Errorf("unknown protocol path: %s", urlPath)
}

// IsAuthenticated checks if the user is authenticated
func (a *App) IsAuthenticated() bool {
	return strings.TrimSpace(a.userToken) != ""
}

// GetGuilds returns the list of Discord guilds (servers) the bot has access to
func (a *App) GetGuilds() string {
	// Get guilds from auth server (Lambda) - NO TOKEN NEEDED
	authGuilds, err := a.authClient.GetGuilds()
	if err != nil {
		log.Printf("Error getting guilds: %v", err)
		return "[]"
	}
	
	// Convert to JSON string
	type guild struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Icon string `json:"icon"`
	}
	
	guilds := make([]guild, len(authGuilds))
	for i, g := range authGuilds {
		guilds[i] = guild{
			ID:   g.ID,
			Name: g.Name,
			Icon: g.Icon,
		}
	}
	
	data, err := json.Marshal(guilds)
	if err != nil {
		log.Printf("Error marshaling guilds: %v", err)
		return "[]"
	}
	return string(data)
}

// GetChannels returns the voice channels for a specific guild
func (a *App) GetChannels(guildID string) string {
	// Get channels from auth server (Lambda) - NO TOKEN NEEDED
	authChannels, err := a.authClient.GetChannels(guildID)
	if err != nil {
		log.Printf("Error getting channels: %v", err)
		return "[]"
	}
	
	// Convert to JSON string
	type channel struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		Position int    `json:"position"`
	}
	
	channels := make([]channel, len(authChannels))
	for i, c := range authChannels {
		channels[i] = channel{
			ID:       c.ID,
			Name:     c.Name,
			Position: c.Position,
		}
	}
	
	data, err := json.Marshal(channels)
	if err != nil {
		log.Printf("Error marshaling channels: %v", err)
		return "[]"
	}
	return string(data)
}

// StartStreaming starts the streaming
func (a *App) StartStreaming(guildID, channelID string) error {
	// Get bot token from Lambda using user token
	if a.userToken == "" {
		return fmt.Errorf("not authenticated - please authenticate first")
	}
	
	botToken, err := a.authClient.GetBotToken(a.userToken)
	if err != nil {
		return fmt.Errorf("failed to get bot token: %v", err)
	}

	return a.streamer.Connect(botToken, guildID, channelID)
}

// StopStreaming stops the streaming
func (a *App) StopStreaming() {
	if a.streamer.IsConnected() {
		a.streamer.Disconnect()
	}
	// Send stop signal to connected Chrome extensions
	a.wsServer.StopStreamingFromWaitingMode()
}

// Quit quits the application
func (a *App) Quit() {
	a.StopStreaming()
	// Wails will handle the actual quit
}

// startHTTPServer starts a local HTTP server for API endpoints
// startHTTPServer starts the HTTP server for OAuth callback
func (a *App) startHTTPServer() {
	// Create a simple HTTP server for OAuth callback
	mux := http.NewServeMux()
	
	// Handle OAuth callback
	mux.HandleFunc("/auth/callback", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[HTTP] Auth callback received")
		
		// Parse query parameters
		token := r.URL.Query().Get("token")
		guildsJSON := r.URL.Query().Get("guilds")
		
		if token == "" {
			http.Error(w, "No token provided", http.StatusBadRequest)
			return
		}
		
		// Store the token
		a.userToken = token
		
		// Parse guilds if provided
		if guildsJSON != "" {
			var guilds []auth.Guild
			if err := json.Unmarshal([]byte(guildsJSON), &guilds); err == nil {
				// Store guilds for later use
				log.Printf("[HTTP] Received %d guilds", len(guilds))
			}
		}
		
		// Emit event to frontend
		if a.ctx != nil {
			if err := runtime.EventsEmit(a.ctx, "auth:success", map[string]interface{}{
				"authenticated": true,
			}); err != nil {
				log.Printf("Failed to emit auth:success event: %v", err)
			}
		}
		
		// Return success page
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Authentication Successful</title>
				<style>
					body {
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						display: flex;
						justify-content: center;
						align-items: center;
						height: 100vh;
						margin: 0;
						background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
						color: white;
					}
					.container {
						text-align: center;
						padding: 2rem;
						background: rgba(255, 255, 255, 0.1);
						border-radius: 10px;
						backdrop-filter: blur(10px);
					}
				</style>
			</head>
			<body>
				<div class="container">
					<h1>✅ Authentication Successful!</h1>
					<p>You can now return to the trunecord app.</p>
				</div>
				<script>
					// Try to focus the app window
					setTimeout(() => {
						window.close();
					}, 2000);
				</script>
			</body>
			</html>
		`))
	})
	
	// Start server
	server := &http.Server{
		Addr:    ":" + a.config.WebPort,
		Handler: mux,
	}
	
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("[HTTP] Server error: %v", err)
	}
}


// onSecondInstance handles when a second instance is launched (e.g., via protocol URL)
func (a *App) onSecondInstance(secondInstanceArgs options.SecondInstanceData) {
	log.Printf("[onSecondInstance] Called with args: %v", secondInstanceArgs.Args)
	
	// Check if launched with a protocol URL
	for _, arg := range secondInstanceArgs.Args {
		if strings.HasPrefix(arg, "trunecord://") {
			log.Printf("[onSecondInstance] Found protocol URL: %s", arg)
			
			// Handle the protocol URL
			if err := a.HandleProtocol(arg); err != nil {
				log.Printf("[onSecondInstance] Failed to handle protocol URL: %v", err)
				// Emit error event
				if a.ctx != nil {
					if emitErr := runtime.EventsEmit(a.ctx, "auth:error", map[string]interface{}{
						"error": err.Error(),
					}); emitErr != nil {
						log.Printf("Failed to emit auth:error event: %v", emitErr)
					}
				}
			} else {
				log.Printf("[onSecondInstance] Successfully handled protocol URL")
				// The HandleProtocol -> HandleAuthCallback will emit auth:success event
			}
			break
		}
	}
}

// CheckProtocolArg checks command line arguments for protocol URLs
// This is now only used for manual debugging. Protocol handling happens via onSecondInstance
func (a *App) CheckProtocolArg() {
	log.Printf("[CheckProtocolArg] Args: %v", os.Args)
	
	// Log protocol URLs found in args but don't process them automatically
	// This prevents auto-authentication on startup
	for _, arg := range os.Args[1:] {
		if strings.HasPrefix(arg, "trunecord://") {
			log.Printf("[CheckProtocolArg] Protocol URL found in args (not processing automatically): %s", arg)
			// Note: Protocol URLs should be handled via onSecondInstance callback
			// or manual user authentication to ensure proper UX flow
		}
	}
}

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "trunecord - Music to Discord",
		Width:     1024,
		Height:    768,
		MinWidth:  800,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		Mac: &mac.Options{
			TitleBar: mac.TitleBarDefault(),
			About: &mac.AboutInfo{
				Title:   "trunecord",
				Message: "Stream YouTube Music to Discord",
				Icon:    nil, // Will use app icon
			},
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			DisableWindowIcon:    false,
		},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId:               "trunecord-app-instance",
			OnSecondInstanceLaunch: app.onSecondInstance,
		},
	})

	if err != nil {
		log.Fatal("Error:", err)
	}
}