#!/bin/bash
# Package macOS binary as an app bundle

set -e

if [ $# -ne 3 ]; then
    echo "Usage: $0 <binary-path> <output-dir> <arch>"
    exit 1
fi

BINARY_PATH=$1
OUTPUT_DIR=$2
ARCH=$3
APP_NAME="trunecord"
BUNDLE_NAME="${APP_NAME}.app"

# Create app bundle structure
BUNDLE_PATH="${OUTPUT_DIR}/${BUNDLE_NAME}"
mkdir -p "${BUNDLE_PATH}/Contents/MacOS"
mkdir -p "${BUNDLE_PATH}/Contents/Resources"

# Copy binary
cp "$BINARY_PATH" "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}"
chmod +x "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}"

# Create Info.plist
cat > "${BUNDLE_PATH}/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>com.trunecord.app</string>
    <key>CFBundleName</key>
    <string>trunecord</string>
    <key>CFBundleDisplayName</key>
    <string>trunecord (Music to Discord)</string>
    <key>CFBundleVersion</key>
    <string>1.0.3</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.3</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.12</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <true/>
    <key>LSBackgroundOnly</key>
    <false/>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>
EOF

# Create launcher script
cat > "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}-launcher" << 'EOF'
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$HOME/Library/Logs/trunecord"
LOG_FILE="$LOG_DIR/trunecord.log"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Check if trunecord is already running
if pgrep -f "${DIR}/trunecord-bin" > /dev/null; then
    # If running, open the web interface
    open "http://localhost:48766"
else
    # Start trunecord in background and redirect output to log
    "${DIR}/trunecord-bin" >> "$LOG_FILE" 2>&1 &
    
    # Wait a moment for the server to start
    sleep 2
    
    # Open the web interface
    open "http://localhost:48766"
    
    # Show notification
    osascript -e 'display notification "trunecord is now running. Check http://localhost:48766" with title "trunecord Started"'
fi
EOF
chmod +x "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}-launcher"

# Rename the actual binary and make launcher the main executable
mv "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}" "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}-bin"
mv "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}-launcher" "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}"

# Create stop script
cat > "${BUNDLE_PATH}/Contents/MacOS/stop-trunecord" << 'EOF'
#!/bin/bash
# Stop trunecord if it's running
pkill -f "trunecord-bin"
osascript -e 'display notification "trunecord has been stopped" with title "trunecord Stopped"'
EOF
chmod +x "${BUNDLE_PATH}/Contents/MacOS/stop-trunecord"

# Create icon (placeholder - you can add a proper .icns file later)
touch "${BUNDLE_PATH}/Contents/Resources/icon.icns"

# Create a simple README for the DMG
cat > "${OUTPUT_DIR}/README.txt" << 'EOF'
trunecord for macOS
==================

To use trunecord:
1. Drag trunecord.app to your Applications folder
2. Double-click trunecord.app to start
3. Your browser will open to http://localhost:48766
4. The app runs in the background

To stop trunecord:
- Run: pkill -f trunecord-bin
- Or use Activity Monitor

Logs are stored in: ~/Library/Logs/trunecord/

For more info: https://github.com/cahlchang/trunecord
EOF

# Create DMG
DMG_NAME="trunecord-darwin-${ARCH}.dmg"
hdiutil create -volname "trunecord" -srcfolder "${BUNDLE_PATH}" -ov -format UDZO "${OUTPUT_DIR}/${DMG_NAME}"

echo "macOS app bundle created: ${OUTPUT_DIR}/${DMG_NAME}"