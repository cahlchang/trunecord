# trunecord - Go Client Build Configuration

BINARY_NAME=trunecord
VERSION=$(shell git describe --tags --always --dirty)
BUILD_TIME=$(shell date '+%Y-%m-%d_%H:%M:%S')
BUILD_COMMIT=$(shell git rev-parse HEAD)

# Build flags
LDFLAGS=-s -w \
	-X main.Version=$(VERSION) \
	-X main.BuildTime=$(BUILD_TIME) \
	-X main.BuildCommit=$(BUILD_COMMIT)

# Default target
.PHONY: all
all: build

# Clean build artifacts
.PHONY: clean
clean:
	rm -rf dist/
	rm -f $(BINARY_NAME)*
	go clean

# Install dependencies
.PHONY: deps
deps:
	go mod download
	go mod tidy

# Build for current platform
.PHONY: build
build:
	go build -ldflags="$(LDFLAGS)" -o $(BINARY_NAME) ./cmd

# Development build with race detection
.PHONY: dev
dev:
	go build -race -o $(BINARY_NAME)-dev ./cmd

# Build for all platforms
.PHONY: build-all
build-all: clean
	mkdir -p dist
	
	# Windows AMD64
	GOOS=windows GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o dist/$(BINARY_NAME)-windows-amd64.exe ./cmd
	
	# Windows ARM64
	GOOS=windows GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o dist/$(BINARY_NAME)-windows-arm64.exe ./cmd
	
	# macOS AMD64
	GOOS=darwin GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o dist/$(BINARY_NAME)-darwin-amd64 ./cmd
	
	# macOS ARM64 (Apple Silicon)
	GOOS=darwin GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o dist/$(BINARY_NAME)-darwin-arm64 ./cmd
	
	# Linux AMD64
	GOOS=linux GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o dist/$(BINARY_NAME)-linux-amd64 ./cmd
	
	# Linux ARM64
	GOOS=linux GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o dist/$(BINARY_NAME)-linux-arm64 ./cmd

# Build with embedded static assets (requires embed package)
.PHONY: build-embed
build-embed:
	go build -tags embed -ldflags="$(LDFLAGS)" -o $(BINARY_NAME) ./cmd

# Test
.PHONY: test
test:
	CGO_ENABLED=1 go test -v ./...

# Test with coverage
.PHONY: test-coverage
test-coverage:
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Run linter
.PHONY: lint
lint:
	golangci-lint run

# Format code
.PHONY: fmt
fmt:
	go fmt ./...

# Run the application
.PHONY: run
run: build
	./$(BINARY_NAME)

# Run in development mode
.PHONY: run-dev
run-dev:
	go run ./cmd

# Install to system
.PHONY: install
install:
	go install -ldflags="$(LDFLAGS)" ./cmd

# Create release packages
.PHONY: package
package: build-all
	cd dist && \
	for file in *; do \
		if [[ $$file == *"windows"* ]]; then \
			zip "$${file%.*}.zip" "$$file"; \
		else \
			tar -czf "$${file}.tar.gz" "$$file"; \
		fi; \
	done

# Docker build
.PHONY: docker
docker:
	docker build -t $(BINARY_NAME):$(VERSION) .
	docker build -t $(BINARY_NAME):latest .

# Show help
.PHONY: help
help:
	@echo "Available commands:"
	@echo "  build        - Build for current platform"
	@echo "  build-all    - Build for all supported platforms"
	@echo "  build-embed  - Build with embedded static assets"
	@echo "  clean        - Clean build artifacts"
	@echo "  deps         - Install dependencies"
	@echo "  dev          - Development build with race detection"
	@echo "  docker       - Build Docker image"
	@echo "  fmt          - Format code"
	@echo "  help         - Show this help"
	@echo "  install      - Install to system"
	@echo "  lint         - Run linter"
	@echo "  package      - Create release packages"
	@echo "  run          - Build and run"
	@echo "  run-dev      - Run in development mode"
	@echo "  test         - Run tests"
	@echo "  test-coverage - Run tests with coverage"