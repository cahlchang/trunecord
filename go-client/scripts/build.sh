#!/bin/bash

# trunecord - Cross Platform Build Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BINARY_NAME="trunecord"
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME=$(date '+%Y-%m-%d_%H:%M:%S')
BUILD_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

# Build flags
LDFLAGS="-s -w -X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME} -X main.BuildCommit=${BUILD_COMMIT}"

echo -e "${GREEN}Building trunecord Go Client${NC}"
echo -e "Version: ${YELLOW}${VERSION}${NC}"
echo -e "Build Time: ${YELLOW}${BUILD_TIME}${NC}"
echo -e "Commit: ${YELLOW}${BUILD_COMMIT}${NC}"
echo ""

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf dist/
mkdir -p dist/

# Build targets
declare -a platforms=(
    "windows/amd64"
    "windows/arm64"
    "darwin/amd64"
    "darwin/arm64"
    "linux/amd64"
    "linux/arm64"
)

for platform in "${platforms[@]}"; do
    IFS='/' read -r os arch <<< "$platform"
    
    echo -e "${YELLOW}Building for ${os}/${arch}...${NC}"
    
    output_name="${BINARY_NAME}-${os}-${arch}"
    if [ "$os" = "windows" ]; then
        output_name="${output_name}.exe"
    fi
    
    GOOS=$os GOARCH=$arch go build \
        -ldflags="${LDFLAGS}" \
        -o "dist/${output_name}" \
        ./cmd
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Built ${output_name}${NC}"
    else
        echo -e "${RED}✗ Failed to build ${output_name}${NC}"
        exit 1
    fi
done

echo ""
echo -e "${GREEN}Build completed successfully!${NC}"
echo -e "Artifacts available in ${YELLOW}dist/${NC} directory:"
ls -la dist/

# Create checksums
echo ""
echo -e "${YELLOW}Generating checksums...${NC}"
cd dist/
sha256sum * > checksums.txt
cd ..
echo -e "${GREEN}✓ Checksums generated${NC}"

echo ""
echo -e "${GREEN}Build process completed!${NC}"