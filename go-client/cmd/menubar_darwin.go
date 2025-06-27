//go:build darwin
// +build darwin

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
	go systray.Run(func() {
		onReady(app)
	}, onExit)
}

func onReady(app *Application) {
	// Set icon
	systray.SetIcon(icon.Data)
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
				exec.Command("open", "-a", "Console", fmt.Sprintf("%s/Library/Logs/trunecord/trunecord.log", os.Getenv("HOME"))).Start()
			case <-mQuit.ClickedCh:
				log.Println("Quitting trunecord from menu bar")
				if app.streamer.IsConnected() {
					app.streamer.Disconnect()
				}
				systray.Quit()
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
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		log.Printf("Cannot open browser on this platform")
	}
	if err != nil {
		log.Printf("Failed to open browser: %v", err)
	}
}

func runApp(app *Application) {
	// Setup menu bar with systray
	setupMenuBarSystray(app)
	
	// Run the main application logic
	app.run()
}

func setupMenuBar(app *Application) {
	// Deprecated: Using setupMenuBarSystray instead
	setupMenuBarSystray(app)
}