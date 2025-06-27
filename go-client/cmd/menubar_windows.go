//go:build windows
// +build windows

package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"time"

	"github.com/getlantern/systray"
	"trunecord/internal/icon"
)

func setupMenuBarSystray(app *Application) {
	// systray.Run is blocking, so we need to run it in the main thread
	// and run the app logic in a goroutine
	systray.Run(func() {
		onReady(app)
	}, onExit)
}

func onReady(app *Application) {
	// Set icon - use ICO format for Windows
	systray.SetIcon(icon.DataICO)
	systray.SetTooltip("trunecord - Music to Discord")
	
	// Add menu items
	mTitle := systray.AddMenuItem("trunecord", "")
	mTitle.Disable()
	systray.AddSeparator()
	
	// Status items (will be updated dynamically)
	mStatus := systray.AddMenuItem("○ Not Connected", "")
	mStatus.Disable()
	
	mStreamStatus := systray.AddMenuItem("", "")
	mStreamStatus.Hide()
	
	systray.AddSeparator()
	
	// Action items
	mOpenWeb := systray.AddMenuItem("Open Web Interface", "Open the web interface")
	mViewLogs := systray.AddMenuItem("View Logs", "View application logs")
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Quit trunecord", "Quit the application")
	
	// Handle menu clicks
	go func() {
		for {
			select {
			case <-mOpenWeb.ClickedCh:
				openBrowser(fmt.Sprintf("http://localhost:%s", app.config.WebPort))
			case <-mViewLogs.ClickedCh:
				// On Windows, open log directory in Explorer
				logDir := fmt.Sprintf("%s\\AppData\\Local\\trunecord\\logs", os.Getenv("USERPROFILE"))
				exec.Command("explorer", logDir).Start()
			case <-mQuit.ClickedCh:
				log.Println("Quitting trunecord from system tray")
				if app.streamer.IsConnected() {
					app.streamer.Disconnect()
				}
				os.Exit(0)
			}
		}
	}()
	
	// Update status periodically
	go func() {
		for {
			if app.streamer.IsConnected() {
				mStatus.SetTitle("✓ Connected to Discord")
				mStreamStatus.Show()
				if app.wsServer.IsStreaming() {
					mStreamStatus.SetTitle("♫ Streaming")
				} else {
					mStreamStatus.SetTitle("⏸ Not Streaming")
				}
			} else {
				mStatus.SetTitle("○ Not Connected")
				mStreamStatus.Hide()
			}
			// Update every 1 second
			time.Sleep(1 * time.Second)
		}
	}()
}

func onExit() {
	// Cleanup
}

func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	default:
		log.Printf("Cannot open browser on this platform")
	}
	if err != nil {
		log.Printf("Failed to open browser: %v", err)
	}
}

func runApp(app *Application) {
	// Run the main application logic in a goroutine
	go app.run()
	
	// Setup system tray with systray (this blocks)
	setupMenuBarSystray(app)
}

func setupMenuBar(app *Application) {
	// Deprecated: Using setupMenuBarSystray instead
	setupMenuBarSystray(app)
}