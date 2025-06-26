package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"trunecord/internal/auth"
	"trunecord/internal/config"
	"trunecord/internal/discord"
	"trunecord/internal/web"
	"trunecord/internal/websocket"
)

var (
	webSocketPort = flag.String("websocket-port", "", "WebSocket server port (default: 8765)")
	webPort       = flag.String("web-port", "", "Web server port (default: 48766)")
	botToken      = flag.String("bot-token", "", "Discord bot token")
	authURL       = flag.String("auth-url", "", "Authentication API URL")
)

func main() {
	flag.Parse()

	// Check if audio streaming is supported
	if err := checkAudioSupport(); err != nil {
		log.Printf("WARNING: %v", err)
		log.Printf("This build does not support audio streaming. Please compile from source with CGO enabled:")
		log.Printf("  CGO_ENABLED=1 go build ./cmd/main.go")
		log.Printf("")
		log.Printf("Or download a platform-specific build from:")
		log.Printf("  https://github.com/cahlchang/trunecord/releases")
		os.Exit(1)
	}

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Override with command line flags
	if *webSocketPort != "" {
		cfg.WebSocketPort = *webSocketPort
	}
	if *webPort != "" {
		cfg.WebPort = *webPort
	}
	if *botToken != "" {
		cfg.DiscordBotToken = *botToken
	}
	if *authURL != "" {
		cfg.AuthAPIURL = *authURL
	}

	log.Printf("Starting trunecord (Music to Discord) Go Client")
	log.Printf("WebSocket Port: %s", cfg.WebSocketPort)
	log.Printf("Web Port: %s", cfg.WebPort)
	log.Printf("Auth API URL: %s", cfg.AuthAPIURL)

	// Initialize components
	authClient := auth.NewClient(cfg.AuthAPIURL)
	streamer := discord.NewStreamer()
	wsServer := websocket.NewServer()
	webServer := web.NewServer(cfg.WebPort, authClient, streamer, wsServer)

	// Create application context
	app := &Application{
		config:     cfg,
		streamer:   streamer,
		wsServer:   wsServer,
		webServer:  webServer,
		authClient: authClient,
	}

	// Start servers
	var wg sync.WaitGroup

	// Start WebSocket server
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := app.startWebSocketServer(); err != nil {
			log.Fatalf("WebSocket server failed: %v", err)
		}
	}()

	// Start web server
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := app.startWebServer(); err != nil {
			log.Fatalf("Web server failed: %v", err)
		}
	}()

	// Start audio streaming handler
	wg.Add(1)
	go func() {
		defer wg.Done()
		app.handleAudioStreaming()
	}()

	// Wait for interrupt signal
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	<-c
	log.Println("Shutting down...")

	// Cleanup
	if err := streamer.Disconnect(); err != nil {
		log.Printf("Error disconnecting from Discord: %v", err)
	}

	log.Println("Shutdown complete")
}

type Application struct {
	config     *config.Config
	streamer   *discord.Streamer
	wsServer   *websocket.Server
	webServer  *web.Server
	authClient *auth.Client
}

func (app *Application) startWebSocketServer() error {
	log.Printf("Starting WebSocket server on port %s", app.config.WebSocketPort)
	return app.wsServer.Start(app.config.WebSocketPort)
}

func (app *Application) startWebServer() error {
	log.Printf("Starting web server on port %s", app.config.WebPort)
	return app.webServer.Start()
}

func (app *Application) handleAudioStreaming() {
	audioChannel := app.wsServer.GetAudioChannel()

	// Create a continuous audio channel for Discord streaming with larger buffer
	discordAudioChannel := make(chan []byte, 1000)

	// Start Discord streaming when connected
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()

		for range ticker.C {
			if app.streamer.IsConnected() && !app.streamer.IsStreaming() {
				if err := app.streamer.StartStreaming(discordAudioChannel); err != nil {
					log.Printf("Failed to start Discord streaming: %v", err)
				}
			}
		}
	}()

	// Forward audio from WebSocket to Discord
	for audioData := range audioChannel {
		if app.streamer.IsConnected() {
			select {
			case discordAudioChannel <- audioData:
				// Audio forwarded successfully
			default:
				// Channel full, skip this chunk silently
			}
		}
	}
}
