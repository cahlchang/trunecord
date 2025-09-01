package browser

import (
	"fmt"
	"log"
	"os/exec"
	"runtime"
	"strings"

	"trunecord/internal/constants"
)

// Opener handles browser operations across different platforms
type Opener struct{}

// NewOpener creates a new browser opener
func NewOpener() *Opener {
	return &Opener{}
}

// Open opens a URL in the default browser
func (o *Opener) Open(url string) error {
	log.Printf("Attempting to open browser at %s", url)

	switch runtime.GOOS {
	case "linux":
		return exec.Command(constants.LinuxOpenCommand, url).Start()
	case "windows":
		return exec.Command(constants.WindowsOpenCommand, constants.WindowsOpenArgs, url).Start()
	case "darwin":
		return o.openOnMacOS(url)
	default:
		log.Printf("Cannot auto-open browser on this platform. Please visit: %s", url)
		return nil
	}
}

// BringToFront brings an existing browser window to front with the specified URL
func (o *Opener) BringToFront(url string) error {
	switch runtime.GOOS {
	case "darwin":
		return o.bringToFrontOnMacOS(url)
	case "linux":
		return exec.Command(constants.LinuxOpenCommand, url).Run()
	case "windows":
		return exec.Command(constants.WindowsOpenCommand, constants.WindowsOpenArgs, url).Run()
	default:
		return o.Open(url)
	}
}

// openOnMacOS opens URL on macOS using the 'open' command
func (o *Opener) openOnMacOS(url string) error {
	cmd := exec.Command(constants.MacOSOpenCommand, url)
	err := cmd.Run()
	
	if err != nil {
		// Fallback: Use osascript to open URL
		script := fmt.Sprintf(`open location "%s"`, escapeAppleScriptArg(url))
		cmd = exec.Command("osascript", "-e", script)
		err = cmd.Run()
	}
	
	return err
}

// bringToFrontOnMacOS brings browser window to front on macOS
func (o *Opener) bringToFrontOnMacOS(url string) error {
	// First, get the default browser
	defaultBrowser := o.getDefaultBrowser()
	log.Printf("Default browser: %s", defaultBrowser)
	
	script := o.buildBrowserScript(defaultBrowser, escapeAppleScriptArg(url))
	
	if script != "" {
		cmd := exec.Command("osascript", "-e", script)
		err := cmd.Run()
		if err == nil {
			log.Println("Brought existing browser window to front")
			return nil
		}
	}
	
	// Fallback: just open the URL with system default
	return exec.Command(constants.MacOSOpenCommand, url).Run()
}

// buildBrowserScript creates AppleScript for specific browsers
func (o *Opener) buildBrowserScript(browserName, url string) string {
	switch browserName {
	case constants.Safari, constants.SafariApp:
		return fmt.Sprintf(`
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
		
	case constants.GoogleChrome, constants.GoogleChromeApp:
		return fmt.Sprintf(`
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
		
	case constants.Arc, constants.ArcApp:
		return fmt.Sprintf(`
			tell application "Arc"
				activate
				open location "%s"
			end tell
		`, url)
		
	case constants.Firefox, constants.FirefoxApp:
		return fmt.Sprintf(`
			tell application "Firefox"
				activate
				open location "%s"
			end tell
		`, url)
		
	case constants.MicrosoftEdge, constants.MicrosoftEdgeApp:
		return fmt.Sprintf(`
			tell application "Microsoft Edge"
				activate
				open location "%s"
			end tell
		`, url)
		
	default:
		// For unknown browsers, just try to open the URL  
		return fmt.Sprintf(`open location "%s"`, url)
	}
}

// escapeAppleScriptArg escapes double quotes for AppleScript literals
func escapeAppleScriptArg(s string) string {
	return strings.ReplaceAll(s, `"`, `\"`)
}

// getDefaultBrowser returns the default browser on macOS
func (o *Opener) getDefaultBrowser() string {
	// Get the default browser on macOS
	cmd := exec.Command("defaults", "read", "com.apple.LaunchServices/com.apple.launchservices.secure", "LSHandlers")
	output, err := cmd.Output()
	if err == nil {
		return o.parseBrowserFromLSHandlers(string(output))
	}
	
	// Fallback: try a simpler method
	cmd = exec.Command("osascript", "-e", `tell application "System Events" to get name of first application process whose frontmost is true`)
	if output, err := cmd.Output(); err == nil {
		return strings.TrimSpace(string(output))
	}
	
	// Default to Safari if we can't determine
	return constants.Safari
}

// parseBrowserFromLSHandlers parses browser information from macOS LSHandlers
func (o *Opener) parseBrowserFromLSHandlers(output string) string {
	// Parse the output to find the default browser for http/https
	lines := strings.Split(output, "\n")
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
						return o.mapBundleIDToAppName(bundleID)
					}
				}
			}
		}
	}
	return constants.Safari
}

// mapBundleIDToAppName maps macOS bundle IDs to application names
func (o *Opener) mapBundleIDToAppName(bundleID string) string {
	switch bundleID {
	case constants.SafariBundleID:
		return constants.Safari
	case constants.ChromeBundleID:
		return constants.GoogleChrome
	case constants.ArcBundleID:
		return constants.Arc
	case constants.FirefoxBundleID:
		return constants.Firefox
	case constants.EdgeBundleID:
		return constants.MicrosoftEdge
	default:
		return constants.Safari
	}
}