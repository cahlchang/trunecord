package main

import (
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"trunecord/internal/auth"
	"trunecord/internal/config"
	"trunecord/internal/constants"
	"trunecord/internal/discord"
	"trunecord/internal/web"
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
	a.startServers()
	a.printStatus()
	a.handleGracefulShutdown()
}

func (a *App) startServers() {
	a.startWebSocketServer()
	a.startAudioStreaming()
	a.startWebServer()
	// Browser auto-open is handled by web.Server
}

func (a *App) startWebSocketServer() {
	// Start WebSocket server for Chrome extension
	go func() {
		log.Printf("Starting WebSocket server on port %s", a.config.WebSocketPort)
		if err := a.wsServer.Start(a.config.WebSocketPort); err != nil {
			log.Printf("WebSocket server error: %v", err)
		}
	}()
}

func (a *App) startAudioStreaming() {
	// Connect WebSocket audio buffer to Discord streamer
	go func() {
		ticker := time.NewTicker(constants.WebSocketTickerInterval)
		defer ticker.Stop()

		for range ticker.C {
			if a.streamer.IsConnected() && !a.streamer.IsStreaming() {
				// Start streaming with WebSocket audio buffer
				err := a.streamer.StartStreaming(a.wsServer.GetAudioChannel())
				if err != nil {
					log.Printf("Failed to start streaming: %v", err)
					continue
				}
				log.Printf("Started streaming audio to Discord")
			}
		}
	}()
}

func (a *App) startWebServer() {
	// Start web server for OAuth callback and web UI
	webServer := web.NewServer(a.config.WebPort, a.authClient, a.streamer, a.wsServer, a.config)
	go func() {
		if err := webServer.Start(); err != nil {
			log.Fatalf("Web server error: %v", err)
		}
	}()
}

func (a *App) printStatus() {
	// Print status
	fmt.Println("")
	fmt.Println("App is running!")
	fmt.Println("")
	fmt.Printf("Web Interface: http://%s:%s\n", constants.LocalhostAddress, a.config.WebPort)
	fmt.Printf("WebSocket Port: %s (for Chrome Extension)\n", a.config.WebSocketPort)
	fmt.Println("")
	fmt.Println("Press Ctrl+C to stop")
	fmt.Println("")
}

func (a *App) handleGracefulShutdown() {
	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	fmt.Println("")
	log.Println("Shutting down...")
	if a.streamer.IsConnected() {
		a.streamer.Disconnect()
	}
}

func main() {
	// Set up logging to file when running as .app bundle
	homeDir, _ := os.UserHomeDir()
	logPath := filepath.Join(homeDir, constants.MacOSLogDirectory, constants.LogFileName)

	// Create log directory if it doesn't exist
	os.MkdirAll(filepath.Dir(logPath), constants.LogDirPermission)

	// Open log file
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, constants.LogFilePermission)
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
	tempApp := &App{
		config: cfg,
	}

	// Check for existing instance
	if tempApp.checkExistingInstance() {
		log.Printf("%s is already running", constants.ApplicationName)
		showNotification(constants.AppDisplayName, "Application is already running")
		os.Exit(0)
	}

	fmt.Println("")
	fmt.Println("=====================================")
	fmt.Printf("     %s\n", constants.ApplicationTitle)
	fmt.Println("=====================================")
	fmt.Println("")
	log.Printf("Starting %s...", constants.ApplicationName)

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

func (a *App) checkExistingInstance() bool {
	// Check if configured web port is already in use
	addresses := []string{
		constants.LocalhostIPv4Address,
		constants.LocalhostIPv6Address,
	}

	for _, host := range addresses {
		conn, err := net.Dial("tcp", net.JoinHostPort(host, a.config.WebPort))
		if err != nil {
			continue
		}
		conn.Close()
		// Port is in use, existing instance found
		return true
	}

	// Port is not in use, no existing instance
	return false
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
