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
    <false/>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>
EOF

# Create launcher script that opens Terminal
cat > "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}-launcher" << 'EOF'
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
osascript -e "tell application \"Terminal\" to do script \"'${DIR}/trunecord'; exit\""
EOF
chmod +x "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}-launcher"

# Rename the actual binary and make launcher the main executable
mv "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}" "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}-bin"
mv "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}-launcher" "${BUNDLE_PATH}/Contents/MacOS/${APP_NAME}"

# Create icon (placeholder - you can add a proper .icns file later)
touch "${BUNDLE_PATH}/Contents/Resources/icon.icns"

# Create DMG
DMG_NAME="trunecord-darwin-${ARCH}.dmg"
hdiutil create -volname "trunecord" -srcfolder "${BUNDLE_PATH}" -ov -format UDZO "${OUTPUT_DIR}/${DMG_NAME}"

echo "macOS app bundle created: ${OUTPUT_DIR}/${DMG_NAME}"