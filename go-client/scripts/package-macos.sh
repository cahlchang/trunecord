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
    <key>CFBundleIconFile</key>
    <string>icon</string>
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
    <key>NSUserNotificationAlertStyle</key>
    <string>alert</string>
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
    # The app will show in menu bar
    "${DIR}/trunecord-bin" >> "$LOG_FILE" 2>&1 &
    
    # Wait a moment for the server to start
    sleep 2
    
    # Open the web interface
    open "http://localhost:48766"
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

# Create icon from PNG if available
# Try multiple possible locations
for PNG_PATH in "${OUTPUT_DIR}/../../resource/image.png" "../resource/image.png" "resource/image.png"; do
    if [ -f "$PNG_PATH" ]; then
        ICON_PNG="$PNG_PATH"
        break
    fi
done

if [ -n "$ICON_PNG" ] && [ -f "$ICON_PNG" ]; then
    # Create temporary directory for icon generation
    ICON_TEMP="${OUTPUT_DIR}/icon.iconset"
    mkdir -p "$ICON_TEMP"
    
    # Generate various icon sizes using sips
    sips -z 16 16     "$ICON_PNG" --out "${ICON_TEMP}/icon_16x16.png"
    sips -z 32 32     "$ICON_PNG" --out "${ICON_TEMP}/icon_16x16@2x.png"
    sips -z 32 32     "$ICON_PNG" --out "${ICON_TEMP}/icon_32x32.png"
    sips -z 64 64     "$ICON_PNG" --out "${ICON_TEMP}/icon_32x32@2x.png"
    sips -z 128 128   "$ICON_PNG" --out "${ICON_TEMP}/icon_128x128.png"
    sips -z 256 256   "$ICON_PNG" --out "${ICON_TEMP}/icon_128x128@2x.png"
    sips -z 256 256   "$ICON_PNG" --out "${ICON_TEMP}/icon_256x256.png"
    sips -z 512 512   "$ICON_PNG" --out "${ICON_TEMP}/icon_256x256@2x.png"
    sips -z 512 512   "$ICON_PNG" --out "${ICON_TEMP}/icon_512x512.png"
    sips -z 1024 1024 "$ICON_PNG" --out "${ICON_TEMP}/icon_512x512@2x.png"
    
    # Convert to icns
    iconutil -c icns "$ICON_TEMP" -o "${BUNDLE_PATH}/Contents/Resources/icon.icns"
    rm -rf "$ICON_TEMP"
    
    echo "Created app icon from ${ICON_PNG}"
else
    # Create placeholder icon
    touch "${BUNDLE_PATH}/Contents/Resources/icon.icns"
fi

# Create a simple README for the DMG
cat > "${OUTPUT_DIR}/README.txt" << 'EOF'
trunecord for macOS - Installation Guide
========================================

INSTALLATION:
1. Drag "trunecord.app" to the "Applications" folder (shortcut provided)
2. Close this window
3. Open "trunecord.app" from your Applications folder
   (First time: Right-click → Open to bypass Gatekeeper)

USAGE:
- The app runs in the menu bar (look for ♫ icon)
- Your browser will automatically open to http://localhost:48766
- Configure Discord settings in the web interface
- Click the menu bar icon to:
  - View connection status
  - Open web interface
  - View logs
  - Quit the app

TO STOP:
- Click the ♫ icon in menu bar → Quit trunecord
- Or use Activity Monitor to quit "trunecord-bin"

LOGS:
- ~/Library/Logs/trunecord/trunecord.log

SUPPORT:
- https://github.com/cahlchang/trunecord
EOF

# Create a temporary directory for DMG contents
DMG_TEMP="${OUTPUT_DIR}/dmg-temp"
mkdir -p "${DMG_TEMP}"
cp -r "${BUNDLE_PATH}" "${DMG_TEMP}/"
ln -s /Applications "${DMG_TEMP}/Applications"
cp "${OUTPUT_DIR}/README.txt" "${DMG_TEMP}/"

# Create DMG with nice layout
DMG_NAME="trunecord-darwin-${ARCH}.dmg"
DMG_TEMP_NAME="trunecord-temp.dmg"

# Create initial DMG
hdiutil create -volname "trunecord" -srcfolder "${DMG_TEMP}" -ov -format UDRW -size 100m "${OUTPUT_DIR}/${DMG_TEMP_NAME}"

# Mount the DMG
DEVICE=$(hdiutil attach -readwrite -noverify -noautoopen "${OUTPUT_DIR}/${DMG_TEMP_NAME}" | egrep '^/dev/' | sed 1q | awk '{print $1}')

# Wait for mount
sleep 2

# Set DMG window properties using AppleScript
osascript << EOF
tell application "Finder"
    tell disk "trunecord"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set bounds of container window to {400, 100, 900, 450}
        set viewOptions to the icon view options of container window
        set arrangement of viewOptions to not arranged
        set icon size of viewOptions to 80
        set text size of viewOptions to 12
        set position of item "trunecord.app" of container window to {150, 120}
        set position of item "Applications" of container window to {350, 120}
        set position of item "README.txt" of container window to {250, 280}
        set background picture of viewOptions to POSIX file "/System/Library/CoreServices/DefaultBackground.jpg"
        update without registering applications
        delay 3
        close
    end tell
end tell
EOF

# Unmount
hdiutil detach "${DEVICE}"

# Convert to compressed DMG
hdiutil convert "${OUTPUT_DIR}/${DMG_TEMP_NAME}" -format UDZO -o "${OUTPUT_DIR}/${DMG_NAME}"
rm -f "${OUTPUT_DIR}/${DMG_TEMP_NAME}"
rm -rf "${DMG_TEMP}"

echo "macOS app bundle created: ${OUTPUT_DIR}/${DMG_NAME}"