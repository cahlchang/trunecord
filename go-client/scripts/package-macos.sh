#!/bin/bash

# Comprehensive macOS packaging script for trunecord
# Creates .app bundle, DMG, and optionally signs the application

set -e

# Configuration
APP_NAME="trunecord"
VERSION="1.0.0"
BUNDLE_ID="com.trunecord.app"
BUILD_DIR="build"
DIST_DIR="dist"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
DMG_NAME="$APP_NAME-$VERSION-macOS"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Parse command line arguments
BUILD_UNIVERSAL=false
SIGN_APP=false
NOTARIZE=false
DEVELOPER_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --universal)
            BUILD_UNIVERSAL=true
            shift
            ;;
        --sign)
            SIGN_APP=true
            shift
            ;;
        --developer-id)
            DEVELOPER_ID="$2"
            SIGN_APP=true
            shift 2
            ;;
        --notarize)
            NOTARIZE=true
            SIGN_APP=true
            shift
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --universal          Build universal binary (Intel + Apple Silicon)"
            echo "  --sign              Sign the application"
            echo "  --developer-id ID   Developer ID for signing"
            echo "  --notarize          Notarize the application (requires signing)"
            echo "  --version VERSION   Set version number (default: 1.0.0)"
            echo "  --help              Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            ;;
    esac
done

# Start packaging process
echo ""
echo "======================================"
echo "   📦 trunecord macOS Packager"
echo "======================================"
echo ""
log_info "Version: $VERSION"
log_info "Universal Binary: $BUILD_UNIVERSAL"
log_info "Code Signing: $SIGN_APP"
log_info "Notarization: $NOTARIZE"
echo ""

# Clean previous builds
log_info "Cleaning previous builds..."
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Build the Go binary
log_info "Building Go binary..."
if [ "$BUILD_UNIVERSAL" = true ]; then
    log_info "Building universal binary (Intel + Apple Silicon)..."
    
    # Build for Intel
    CGO_ENABLED=1 GOOS=darwin GOARCH=amd64 go build \
        -ldflags="-s -w -X main.Version=$VERSION" \
        -o "$BUILD_DIR/trunecord-amd64" \
        cmd/main_standalone.go
    
    # Build for Apple Silicon
    CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 go build \
        -ldflags="-s -w -X main.Version=$VERSION" \
        -o "$BUILD_DIR/trunecord-arm64" \
        cmd/main_standalone.go
    
    # Create universal binary
    lipo -create -output "$BUILD_DIR/trunecord" \
        "$BUILD_DIR/trunecord-amd64" \
        "$BUILD_DIR/trunecord-arm64"
    
    # Clean up individual binaries
    rm "$BUILD_DIR/trunecord-amd64" "$BUILD_DIR/trunecord-arm64"
    
    log_success "Universal binary created"
else
    # Build for current architecture
    CGO_ENABLED=1 go build \
        -ldflags="-s -w -X main.Version=$VERSION" \
        -o "$BUILD_DIR/trunecord" \
        cmd/main_standalone.go
    
    log_success "Binary built for current architecture"
fi

# Create app bundle structure
log_info "Creating app bundle..."
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Move binary to app bundle
mv "$BUILD_DIR/trunecord" "$APP_BUNDLE/Contents/MacOS/"
chmod +x "$APP_BUNDLE/Contents/MacOS/trunecord"

# Create Info.plist
log_info "Creating Info.plist..."
cat > "$APP_BUNDLE/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>trunecord</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.14</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key>
            <string>trunecord URL</string>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>trunecord</string>
            </array>
        </dict>
    </array>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
        <key>NSAllowsLocalNetworking</key>
        <true/>
    </dict>
    <key>NSMicrophoneUsageDescription</key>
    <string>trunecord needs access to microphone for audio streaming</string>
</dict>
</plist>
EOF

# Create or copy icon
if [ -f "assets/AppIcon.icns" ]; then
    log_info "Copying existing icon..."
    cp "assets/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
elif [ -f "../extension/assets/icons/icon128.png" ] || [ -f "internal/icon/icon.png" ]; then
    log_info "Creating icon from PNG..."
    ./scripts/create-icns.sh > /dev/null 2>&1 || true
    if [ -f "assets/AppIcon.icns" ]; then
        cp "assets/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
    else
        log_warning "Failed to create icon"
    fi
else
    log_warning "No icon found"
fi

# Code signing
if [ "$SIGN_APP" = true ]; then
    if [ -z "$DEVELOPER_ID" ]; then
        # Try to find developer ID automatically
        DEVELOPER_ID=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | cut -d'"' -f2)
        if [ -z "$DEVELOPER_ID" ]; then
            log_warning "No Developer ID found, skipping signing"
            SIGN_APP=false
        fi
    fi
    
    if [ "$SIGN_APP" = true ]; then
        log_info "Signing application with: $DEVELOPER_ID"
        
        # Sign the binary
        codesign --force --deep --sign "$DEVELOPER_ID" \
            --entitlements entitlements.plist \
            --options runtime \
            "$APP_BUNDLE/Contents/MacOS/trunecord" 2>/dev/null || \
        codesign --force --deep --sign "$DEVELOPER_ID" \
            "$APP_BUNDLE/Contents/MacOS/trunecord"
        
        # Sign the entire app bundle
        codesign --force --deep --sign "$DEVELOPER_ID" \
            --entitlements entitlements.plist \
            --options runtime \
            "$APP_BUNDLE" 2>/dev/null || \
        codesign --force --deep --sign "$DEVELOPER_ID" \
            "$APP_BUNDLE"
        
        # Verify signature
        codesign --verify --verbose "$APP_BUNDLE"
        log_success "Application signed successfully"
    fi
fi

# Create DMG
log_info "Creating DMG installer..."

# Create temporary directory for DMG contents
DMG_TEMP="$BUILD_DIR/dmg-temp"
mkdir -p "$DMG_TEMP"

# Copy app to DMG temp
cp -R "$APP_BUNDLE" "$DMG_TEMP/"

# Create symbolic link to Applications
ln -s /Applications "$DMG_TEMP/Applications"

# Create DMG background and setup (optional)
if [ -f "assets/dmg-background.png" ]; then
    mkdir -p "$DMG_TEMP/.background"
    cp "assets/dmg-background.png" "$DMG_TEMP/.background/background.png"
fi

# Create DS_Store for DMG layout (optional)
if [ -f "assets/DS_Store" ]; then
    cp "assets/DS_Store" "$DMG_TEMP/.DS_Store"
fi

# Build DMG
hdiutil create -fs HFS+ \
    -volname "$APP_NAME" \
    -srcfolder "$DMG_TEMP" \
    "$DIST_DIR/$DMG_NAME.dmg" \
    -ov -format UDZO

# Clean up temp directory
rm -rf "$DMG_TEMP"

log_success "DMG created: $DIST_DIR/$DMG_NAME.dmg"

# Notarization
if [ "$NOTARIZE" = true ] && [ "$SIGN_APP" = true ]; then
    log_info "Notarizing application..."
    log_warning "Notarization requires Apple Developer account credentials"
    
    # Note: Actual notarization would require:
    # xcrun altool --notarize-app \
    #     --primary-bundle-id "$BUNDLE_ID" \
    #     --username "YOUR_APPLE_ID" \
    #     --password "YOUR_APP_SPECIFIC_PASSWORD" \
    #     --file "$DIST_DIR/$DMG_NAME.dmg"
    
    log_warning "Automatic notarization not implemented. Please notarize manually."
fi

# Create ZIP archive
log_info "Creating ZIP archive..."
cd "$BUILD_DIR"
zip -r -q "../$DIST_DIR/$APP_NAME-$VERSION-macOS.zip" "$APP_NAME.app"
cd ..
log_success "ZIP created: $DIST_DIR/$APP_NAME-$VERSION-macOS.zip"

# Calculate checksums
log_info "Calculating checksums..."
cd "$DIST_DIR"
shasum -a 256 *.dmg *.zip > checksums.txt
cd ..

# Final summary
echo ""
echo "======================================"
echo "   📦 Packaging Complete!"
echo "======================================"
echo ""
log_success "Application: $APP_BUNDLE"
log_success "DMG: $DIST_DIR/$DMG_NAME.dmg"
log_success "ZIP: $DIST_DIR/$APP_NAME-$VERSION-macOS.zip"
log_success "Checksums: $DIST_DIR/checksums.txt"
echo ""
echo "File sizes:"
du -h "$DIST_DIR"/*.dmg "$DIST_DIR"/*.zip
echo ""
echo "To install:"
echo "  1. Open $DIST_DIR/$DMG_NAME.dmg"
echo "  2. Drag trunecord to Applications"
echo ""
echo "Or distribute the ZIP file for manual installation."
echo ""

# Test the app bundle
if command -v spctl &> /dev/null && [ "$SIGN_APP" = true ]; then
    log_info "Testing Gatekeeper acceptance..."
    spctl -a -t exec -vv "$APP_BUNDLE" 2>&1 || log_warning "Gatekeeper check failed (app may need notarization)"
fi

log_success "All done! 🎉"