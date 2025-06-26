# Building trunecord

This document provides detailed build instructions for the trunecord Go client.

## Prerequisites

- Go 1.21 or later
- Git
- Make (optional, for using Makefile)

## Build Options

### 1. Quick Build

For a simple build for your current platform:

```bash
go build -o trunecord ./cmd
```

### 2. Optimized Production Build

For a smaller, optimized binary without debug symbols:

```bash
go build -ldflags="-s -w" -o trunecord ./cmd
```

### 3. Version Information

To include version information in your build:

```bash
VERSION=$(git describe --tags --always --dirty)
BUILD_TIME=$(date '+%Y-%m-%d_%H:%M:%S')
COMMIT=$(git rev-parse HEAD)

go build -ldflags="-s -w \
    -X main.Version=${VERSION} \
    -X main.BuildTime=${BUILD_TIME} \
    -X main.BuildCommit=${COMMIT}" \
    -o trunecord ./cmd
```

## Platform-Specific Builds

### Windows

```bash
# 64-bit
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o trunecord-windows-amd64.exe ./cmd

# ARM64
GOOS=windows GOARCH=arm64 go build -ldflags="-s -w" -o trunecord-windows-arm64.exe ./cmd

# 32-bit (legacy)
GOOS=windows GOARCH=386 go build -ldflags="-s -w" -o trunecord-windows-386.exe ./cmd
```

### macOS

```bash
# Intel Macs
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o trunecord-darwin-amd64 ./cmd

# Apple Silicon (M1/M2)
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o trunecord-darwin-arm64 ./cmd
```

### Linux

```bash
# 64-bit
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o trunecord-linux-amd64 ./cmd

# ARM64
GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o trunecord-linux-arm64 ./cmd

# ARM (32-bit)
GOOS=linux GOARCH=arm go build -ldflags="-s -w" -o trunecord-linux-arm ./cmd

# 32-bit (legacy)
GOOS=linux GOARCH=386 go build -ldflags="-s -w" -o trunecord-linux-386 ./cmd
```

## Build Automation

### Using Make

The project includes a Makefile for common build tasks:

```bash
# Show all available commands
make help

# Build for current platform
make build

# Development build with race detection
make dev

# Build for all platforms
make build-all

# Create release packages (zip/tar.gz)
make package

# Run tests
make test

# Run tests with coverage
make test-coverage

# Clean build artifacts
make clean
```

### Using Build Script

The build script automates cross-platform builds:

```bash
# Make executable (first time only)
chmod +x scripts/build.sh

# Run build script
./scripts/build.sh
```

This creates optimized binaries for all supported platforms in the `dist/` directory.

## Docker Build

To build a Docker image:

```bash
# Build image
docker build -t trunecord:latest .

# Run container
docker run -p 8765:8765 -p 48766:48766 trunecord:latest
```

## Troubleshooting

### CGO Dependencies

trunecord is built with CGO_ENABLED=0 by default for maximum portability. If you encounter issues:

```bash
CGO_ENABLED=0 go build -o trunecord ./cmd
```

### Module Dependencies

If you have issues with dependencies:

```bash
# Clean module cache
go clean -modcache

# Download dependencies
go mod download

# Verify dependencies
go mod verify

# Tidy dependencies
go mod tidy
```

### Build Errors

Common solutions:

1. **Outdated Go version**: Ensure you have Go 1.21+
   ```bash
   go version
   ```

2. **Missing dependencies**: Run `go mod download`

3. **Permission issues**: Use `sudo` on Unix systems if needed

4. **Windows antivirus**: May need to whitelist the build directory

## Binary Size Optimization

To further reduce binary size:

```bash
# Build with additional optimizations
go build -ldflags="-s -w" -trimpath -o trunecord ./cmd

# Compress with UPX (optional, requires UPX installed)
upx --best --lzma trunecord
```

## Release Builds

For official releases:

1. Tag the version:
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

2. Build with version info:
   ```bash
   make build-all
   ```

3. Create checksums:
   ```bash
   cd dist/
   sha256sum * > checksums.txt
   ```

## Development Builds

For development with hot reload:

```bash
# Install air (first time only)
go install github.com/cosmtrek/air@latest

# Run with hot reload
air
```

Create `.air.toml` for configuration:

```toml
root = "."
testdata_dir = "testdata"
tmp_dir = "tmp"

[build]
  args_bin = []
  bin = "./tmp/main"
  cmd = "go build -o ./tmp/main ./cmd"
  delay = 1000
  exclude_dir = ["assets", "tmp", "vendor", "testdata"]
  exclude_file = []
  exclude_regex = ["_test.go"]
  exclude_unchanged = false
  follow_symlink = false
  full_bin = ""
  include_dir = []
  include_ext = ["go", "tpl", "tmpl", "html"]
  kill_delay = "0s"
  log = "build-errors.log"
  send_interrupt = false
  stop_on_error = true

[color]
  app = ""
  build = "yellow"
  main = "magenta"
  runner = "green"
  watcher = "cyan"

[log]
  time = false

[misc]
  clean_on_exit = false

[screen]
  clear_on_rebuild = false
```