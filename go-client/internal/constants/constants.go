package constants

import "time"

// Network constants
const (
	DefaultWebPort       = "8080"
	DefaultWebSocketPort = "18765"
	LocalhostAddress     = "localhost"
	LocalhostIPv4Address = "127.0.0.1"
	LocalhostIPv6Address = "::1"
)

// Timing constants
const (
	ServerStartupDelay       = 1 * time.Second
	WebSocketTickerInterval  = 1 * time.Second
	AudioFrameInterval       = 20 * time.Millisecond
	StreamingTimeoutDuration = 10 * time.Second
	BrowserOpenDelay         = 1 * time.Second
	VoiceConnectionWaitDelay = 50 * time.Millisecond
	HttpClientTimeout        = 10 * time.Second
	InitialStreamingDelay    = 20 * time.Millisecond
)

// Buffer sizes
const (
	WebSocketBufferSize      = 100
	AudioBufferSize          = 50
	PCMFrameSize             = 960
	PCMBytesPerSample        = 2
	PCMFrameSizeBytes        = PCMFrameSize * PCMBytesPerSample
	PCMBufferMultiplier      = 10
	WebSocketReadBufferSize  = 1024
	WebSocketWriteBufferSize = 1024
)

// Audio constants
const (
	OpusBitrate  = 128000
	SampleRate   = 48000
	MonoChannels = 1
)

// HTTP constants
const (
	ContentTypeJSON     = "application/json"
	ContentTypeHTML     = "text/html; charset=utf-8"
	AuthorizationHeader = "Authorization"
	AcceptHeader        = "Accept"
	BearerPrefix        = "Bearer "
)

// API endpoints
const (
	APIAuthPath       = "/api/auth"
	APIGuildsPath     = "/api/guilds"
	APIVerifyPath     = "/api/verify"
	APIBotTokenPath   = "/api/bot-token"
	APIVersionPath    = "/api/version"
	APIChannelsPath   = "/channels"
	StaticFilesPrefix = "/static/"
)

// WebSocket message types
const (
	MessageTypeHandshake       = "handshake"
	MessageTypeAudio           = "audio"
	MessageTypeStatus          = "status"
	MessageTypeStreamStart     = "streamStart"
	MessageTypeStreamStop      = "streamStop"
	MessageTypeStreamPause     = "streamPause"
	MessageTypeStreamResume    = "streamResume"
	MessageTypeVersionMismatch = "versionMismatch"
)

// Extension version
const (
	ExpectedExtensionVersion = "1.3.5"
	ApplicationVersion       = "1.3.5"
)

// Log paths
const (
	MacOSLogDirectory = "Library/Logs"
	LogFileName       = "trunecord.log"
)

// Application info
const (
	ApplicationName  = "trunecord"
	ApplicationTitle = "trunecord Music Streamer"
	AppDisplayName   = "trunecord"
)

// Browser bundle IDs
const (
	SafariBundleID  = "com.apple.Safari"
	ChromeBundleID  = "com.google.Chrome"
	ArcBundleID     = "company.thebrowser.Browser"
	FirefoxBundleID = "org.mozilla.firefox"
	EdgeBundleID    = "com.microsoft.edgemac"
)

// Browser names
const (
	Safari           = "Safari"
	SafariApp        = "Safari.app"
	GoogleChrome     = "Google Chrome"
	GoogleChromeApp  = "Google Chrome.app"
	Arc              = "Arc"
	ArcApp           = "Arc.app"
	Firefox          = "Firefox"
	FirefoxApp       = "Firefox.app"
	MicrosoftEdge    = "Microsoft Edge"
	MicrosoftEdgeApp = "Microsoft Edge.app"
)

// OS commands
const (
	MacOSOpenCommand   = "open"
	LinuxOpenCommand   = "xdg-open"
	WindowsOpenCommand = "rundll32"
	WindowsOpenArgs    = "url.dll,FileProtocolHandler"
)

// Discord ID validation
const (
	MinDiscordIDLength = 1
	MaxDiscordIDLength = 19
)

// File permissions
const (
	LogDirPermission  = 0755
	LogFilePermission = 0644
)
