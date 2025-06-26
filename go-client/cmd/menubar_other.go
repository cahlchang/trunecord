//go:build !darwin
// +build !darwin

package main

func setupMenuBar(app *Application) {
	// Menu bar is only supported on macOS
}

func runApp(app *Application) {
	// Run the main application logic
	app.run()
}