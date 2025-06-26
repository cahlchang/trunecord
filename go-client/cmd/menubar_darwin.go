//go:build darwin
// +build darwin

package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"

	"github.com/caseymrm/menuet"
)

func setupMenuBar(app *Application) {
	go func() {
		menuet.App().Label = "♫"
		menuet.App().Children = func() []menuet.MenuItem {
			items := []menuet.MenuItem{
				{
					Text: "trunecord",
					Disabled: true,
				},
				{
					Type: menuet.Separator,
				},
			}

			// Add status
			if app.streamer.IsConnected() {
				items = append(items, menuet.MenuItem{
					Text: fmt.Sprintf("✓ Connected to Discord"),
					Disabled: true,
				})
				if app.wsServer.IsStreaming() {
					items = append(items, menuet.MenuItem{
						Text: "♫ Streaming",
						Disabled: true,
					})
				} else {
					items = append(items, menuet.MenuItem{
						Text: "⏸ Not Streaming",
						Disabled: true,
					})
				}
			} else {
				items = append(items, menuet.MenuItem{
					Text: "○ Not Connected",
					Disabled: true,
				})
			}

			items = append(items, menuet.MenuItem{
				Type: menuet.Separator,
			})

			// Add actions
			items = append(items, 
				menuet.MenuItem{
					Text: "Open Web Interface",
					Clicked: func() {
						openBrowser(fmt.Sprintf("http://localhost:%s", app.config.WebPort))
					},
				},
				menuet.MenuItem{
					Text: "View Logs",
					Clicked: func() {
						exec.Command("open", "-a", "Console", fmt.Sprintf("%s/Library/Logs/trunecord/trunecord.log", os.Getenv("HOME"))).Start()
					},
				},
				menuet.MenuItem{
					Type: menuet.Separator,
				},
				menuet.MenuItem{
					Text: "Quit trunecord",
					Clicked: func() {
						log.Println("Quitting trunecord from menu bar")
						if app.streamer.IsConnected() {
							app.streamer.Disconnect()
						}
						menuet.App().Quit()
					},
				},
			)

			return items
		}

		menuet.App().RunApplication()
	}()
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
	// Setup menu bar
	setupMenuBar(app)
	
	// Run the main application logic
	app.run()
}