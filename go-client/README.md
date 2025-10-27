# trunecord (Music to Discord) - Go Client

A single-binary Go implementation of the trunecord (Music to Discord) local client, replacing the Electron version.

## Audio Support

The Go client ships with pre-built binaries that bundle native Opus support. Use the matrix below to pick the right download:

| Platform | Binary | Audio Support | Notes |
| --- | --- | --- | --- |
| Windows (AMD64) | `trunecord-windows-amd64.zip` | ✅ | Includes required DLLs |
| macOS (Intel) | `trunecord-darwin-amd64` | ✅ | `chmod +x` before running |
| macOS (Apple Silicon) | `trunecord-darwin-arm64` | ✅ | `chmod +x` before running |
| Linux (AMD64) | `trunecord-linux-amd64` | ✅ | Run from terminal |
| Linux (ARM64) | `trunecord-linux-arm64-nocgo` | ❌ | Build from source with CGO enabled |

For platforms without bundled audio, compile from source instead:

```bash
# Install opus library first:
# macOS: brew install opus
# Ubuntu/Debian: sudo apt-get install libopus-dev
# Windows: See building instructions below

CGO_ENABLED=1 go build ./cmd/
```

See the [Building from Source](#building-from-source) section below for detailed instructions.

## Prerequisites

- Go 1.21 or later
- Git (for fetching dependencies)

## Features

- **Single Binary**: No dependencies, just download and run
- **Cross-Platform**: Windows, macOS, Linux support
- **WebSocket Server**: Communicates with Chrome extension on port 8765
- **Discord Integration**: Direct audio streaming to Discord voice channels
- **Web UI**: Built-in web interface for authentication and settings
- **Lightweight**: Minimal resource usage compared to Electron
- **IPv4/IPv6 Aware**: Detects running instances across localhost address families
- **Version Handshake**: Validates the Chrome extension (expects v1.3.4+) before streaming

## Version Compatibility

- Chrome extension: **v1.3.4**
- Go client: **v1.3.4** or newer

If versions fall out of sync the client refuses the connection and logs a `versionMismatch` message.

## Architecture

```
go-client/
├── cmd/
│   └── main.go              # Application entry point
├── internal/
│   ├── discord/             # Discord voice connection and streaming
│   ├── websocket/           # WebSocket server for Chrome extension
│   ├── auth/                # Authentication handling
│   └── config/              # Configuration management
├── web/
│   ├── static/              # CSS, JS, images
│   └── templates/           # HTML templates
└── pkg/                     # Public packages
```

## Quick Start

### macOS
1. Download the `.dmg` file for your platform (Intel or Apple Silicon)
2. Double-click the DMG file to mount it
3. Drag the trunecord app to your Applications folder
4. Double-click the app to launch (it will open in Terminal)
5. Open http://localhost:48766 in your browser
6. Follow the setup steps

### Windows
1. Download `trunecord-windows-amd64.zip`
2. Extract the ZIP file to a folder
3. Double-click `trunecord-windows-amd64.exe`
4. Open http://localhost:48766 in your browser
5. Follow the setup steps

### Linux
1. Download the binary for your platform
2. Make it executable: `chmod +x trunecord-linux-amd64`
3. Run the binary: `./trunecord-linux-amd64`
4. Open http://localhost:48766 in your browser
5. Follow the setup steps

## Networking Defaults

- Web interface: `http://localhost:48766`
- WebSocket endpoint for the extension: `ws://127.0.0.1:8765` (also attempts `ws://[::1]:8765`)
- Authentication API (default): `https://m0j3mh0nyj.execute-api.ap-northeast-1.amazonaws.com/prod`

Override these via environment variables or command line flags as described below.

## Building from Source

### Basic Build

```bash
# Development build with debug symbols
go build -o trunecord ./cmd

# Production build (optimized, smaller binary)
go build -ldflags="-s -w" -o trunecord ./cmd
```

### Cross-Platform Builds

```bash
# Windows (64-bit)
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o trunecord-windows-amd64.exe ./cmd

# Windows (ARM64)
GOOS=windows GOARCH=arm64 go build -ldflags="-s -w" -o trunecord-windows-arm64.exe ./cmd

# macOS (Intel)
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o trunecord-darwin-amd64 ./cmd

# macOS (Apple Silicon)
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o trunecord-darwin-arm64 ./cmd

# Linux (64-bit)
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o trunecord-linux-amd64 ./cmd

# Linux (ARM64)
GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o trunecord-linux-arm64 ./cmd
```

### Using Makefile

```bash
# Build for current platform
make build

# Build for all platforms
make build-all

# Clean build artifacts
make clean

# Run tests
make test

# Build and run
make run
```

### Build Script

For automated cross-platform builds:

```bash
# Make the script executable
chmod +x scripts/build.sh

# Run the build script
./scripts/build.sh
```

This will create binaries for all supported platforms in the `dist/` directory.

## Usage

```bash
# Run with default settings
./trunecord

# Specify custom ports
./trunecord -websocket-port 8765 -web-port 48766

# Use custom auth API URL (optional)
./trunecord -auth-url https://your-api-url.com
```

### Configuration

The application can be configured through:

1. **Environment Variables**
   ```bash
   export WEBSOCKET_PORT=8765
   export WEB_PORT=48766
   export AUTH_API_URL=https://your-api-url.com
   ./trunecord
   ```

2. **Command Line Flags**
   ```bash
   ./trunecord -websocket-port 8765 -web-port 48766
   ```

3. **.env File** (create from .env.example)
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ./trunecord
   ```

The application will:
1. Start WebSocket server on port 8765 for Chrome extension
2. Start web server on port 48766 for authentication UI
3. Open browser automatically to the authentication page
4. Handle Discord voice connections and audio streaming

## Technologies & Credits

### CSS Framework
- **Bootstrap 5.3.0** - MIT License
  - Dark theme variant for modern UI
  - https://getbootstrap.com/

### Icons
- **Font Awesome 6.4.0** - Free icons (CC BY 4.0 License)
  - https://fontawesome.com/

### UI Design
- Dark theme inspired by Discord's color palette
- Custom styling for Discord integration elements
