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
	"strings"
	"syscall"
	"time"

	"trunecord/internal/auth"
	"trunecord/internal/config"
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

	// Start web server for OAuth callback and web UI
	webServer := web.NewServer(a.config.WebPort, a.authClient, a.streamer, a.wsServer)
	go func() {
		if err := webServer.Start(); err != nil {
			log.Fatalf("Web server error: %v", err)
		}
	}()

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