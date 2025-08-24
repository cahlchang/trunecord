package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"log"
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

//go:embed all:frontend
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
	
	// HTTPサーバーは開発用のみなので本番では起動しない
	// Start HTTP server for API endpoints (commented out for production)
	// go func() {
	// 	log.Println("Starting HTTP API server on port 8767")
	// 	a.startHTTPServer()
	// }()
	
	// Protocol URL handling is now done only via onSecondInstance or manual authentication
	// This ensures the app shows authentication screen on initial startup
	log.Printf("[Startup] Initial startup completed. User needs to authenticate manually.")
}

// GetStatus returns the current status
func (a *App) GetStatus() map[string]interface{} {
	return map[string]interface{}{
		"connected":  a.streamer.IsConnected(),
		"streaming":  a.wsServer.IsStreaming(),
		"wsPort":     a.config.WebSocketPort,
		"webPort":    a.config.WebPort,
	}
}

// GetAuthURL returns the auth URL for Discord OAuth with custom protocol redirect
func (a *App) GetAuthURL() string {
	// Get the base auth URL
	baseURL := a.authClient.GetAuthURL()
	
	// Append our custom redirect URI parameter
	// This tells the Lambda server to redirect to our custom protocol
	// Note: GetAuthURL returns /api/auth endpoint, so we need to use ? not &
	finalURL := baseURL + "?redirect_protocol=trunecord"
	
	log.Printf("Auth URL generated: %s", finalURL)
	return finalURL
}

// HandleAuthCallback processes the OAuth callback and stores the user token
func (a *App) HandleAuthCallback(callbackURL string) error {
	tokenData, err := a.authClient.ParseAuthCallback(callbackURL)
	if err != nil {
		return fmt.Errorf("failed to parse auth callback: %v", err)
	}
	
	// Store the user token for later use
	a.userToken = tokenData.Token
	
	log.Printf("Successfully authenticated")
	
	// Emit event to frontend to notify authentication success
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "auth:success", map[string]interface{}{
			"authenticated": true,
		})
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
	return a.userToken != ""
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
// Deprecated: HTTPサーバーは開発用のみ。本番ではWailsバインディングを使用
// func (a *App) startHTTPServer() {
// 	// 開発用コードは cmd/api_standalone.go に移動
// }


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
					runtime.EventsEmit(a.ctx, "auth:error", map[string]interface{}{
						"error": err.Error(),
					})
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