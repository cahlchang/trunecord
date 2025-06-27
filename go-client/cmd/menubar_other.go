//go:build !darwin && !windows
// +build !darwin,!windows

package main

func setupMenuBar(app *Application) {
	// Menu bar/system tray is only supported on macOS and Windows
}

func runApp(app *Application) {
	// Run the main application logic
	app.run()
}