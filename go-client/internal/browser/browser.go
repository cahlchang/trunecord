package browser

import (
	"fmt"
	"log"
	"net/url"
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
func (o *Opener) Open(urlStr string) error {
	log.Printf("Attempting to open browser at %s", sanitizeURLForLog(urlStr))

	switch runtime.GOOS {
	case "linux":
		return exec.Command(constants.LinuxOpenCommand, urlStr).Start()
	case "windows":
		return exec.Command(constants.WindowsOpenCommand, constants.WindowsOpenArgs, urlStr).Start()
	case "darwin":
		return o.openOnMacOS(urlStr)
	default:
		log.Printf("Cannot auto-open browser on this platform. Please visit: %s", sanitizeURLForLog(urlStr))
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

// openOnMacOS opens URL on macOS using the default browser
func (o *Opener) openOnMacOS(url string) error {
	cmd := exec.Command(constants.MacOSOpenCommand, url)
	return cmd.Start()
}

// bringToFrontOnMacOS brings browser to front on macOS
func (o *Opener) bringToFrontOnMacOS(url string) error {
	browser := o.getDefaultBrowser()
	if browser == "" {
		browser = constants.SafariBrowser
	}

	// Escape quotes and backslashes in URL for AppleScript
	escapedURL := escapeForAppleScript(url)

	// Create AppleScript to bring browser to front or open new tab
	script := o.getBrowserScript(browser, escapedURL)
	
	cmd := exec.Command(constants.AppleScriptCommand, "-e", script)
	err := cmd.Run()
	if err != nil {
		// Fallback to simply opening the URL
		return o.openOnMacOS(url)
	}
	return nil
}

// escapeForAppleScript escapes special characters for AppleScript
func escapeForAppleScript(s string) string {
	// Escape backslashes first, then quotes
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "\"", "\\\"")
	return s
}

// getDefaultBrowser gets the default browser on macOS
func (o *Opener) getDefaultBrowser() string {
	cmd := exec.Command(constants.DefaultsCommand, constants.DefaultsReadKey, constants.LaunchServicesDomain, constants.HTTPHandlerKey)
	output, err := cmd.Output()
	if err != nil {
		return constants.SafariBrowser
	}

	bundleID := strings.TrimSpace(string(output))
	
	// Map bundle IDs to browser names
	switch bundleID {
	case constants.SafariBundleID:
		return constants.SafariBrowser
	case constants.ChromeBundleID:
		return constants.GoogleChrome
	case constants.FirefoxBundleID:
		return constants.Firefox
	case constants.EdgeBundleID:
		return constants.Edge
	case constants.BraveBundleID:
		return constants.Brave
	case constants.ArcBundleID:
		return constants.Arc
	default:
		return constants.SafariBrowser
	}
}

// getBrowserScript returns AppleScript for specific browser
func (o *Opener) getBrowserScript(browser, url string) string {
	switch browser {
	case constants.SafariBrowser:
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
		
	case constants.Firefox:
		return fmt.Sprintf(`
			tell application "Firefox"
				activate
				open location "%s"
			end tell
		`, url)
		
	case constants.Edge:
		return fmt.Sprintf(`
			tell application "Microsoft Edge"
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
		
	case constants.Brave:
		return fmt.Sprintf(`
			tell application "Brave Browser"
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
		
	case constants.Arc:
		return fmt.Sprintf(`
			tell application "Arc"
				activate
				open location "%s"
			end tell
		`, url)
		
	default:
		// Generic open command
		return fmt.Sprintf(`
			tell application "System Events"
				open location "%s"
			end tell
		`, url)
	}
}

// sanitizeURLForLog removes sensitive query parameters and fragments from URL for logging
func sanitizeURLForLog(u string) string {
	parsed, err := url.Parse(u)
	if err != nil {
		return "<invalid-url>"
	}
	// Remove query parameters and fragment that may contain sensitive data
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.String()
}