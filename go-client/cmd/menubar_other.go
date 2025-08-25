//go:build !darwin && !windows
// +build !darwin,!windows

package main

func setupMenuBar(app *App) {
	// Menu bar/system tray is only supported on macOS and Windows
}

func runApp(app *App) {
	// Run the main application logic
	app.run()
}