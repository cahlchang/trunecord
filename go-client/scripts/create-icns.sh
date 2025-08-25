#!/bin/bash

# Create .icns file from PNG

set -e

SOURCE_PNG="../extension/assets/icons/icon128.png"
ICONSET="assets/AppIcon.iconset"
OUTPUT_ICNS="assets/AppIcon.icns"

echo "🎨 Creating .icns file from PNG..."

# Check if source exists
if [ ! -f "$SOURCE_PNG" ]; then
    SOURCE_PNG="internal/icon/icon.png"
fi

if [ ! -f "$SOURCE_PNG" ]; then
    echo "❌ No source PNG found"
    exit 1
fi

# Create iconset directory
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

# Generate different sizes using sips
echo "📐 Generating icon sizes..."
sips -z 16 16     "$SOURCE_PNG" --out "$ICONSET/icon_16x16.png"      > /dev/null 2>&1
sips -z 32 32     "$SOURCE_PNG" --out "$ICONSET/icon_16x16@2x.png"   > /dev/null 2>&1
sips -z 32 32     "$SOURCE_PNG" --out "$ICONSET/icon_32x32.png"      > /dev/null 2>&1
sips -z 64 64     "$SOURCE_PNG" --out "$ICONSET/icon_32x32@2x.png"   > /dev/null 2>&1
sips -z 128 128   "$SOURCE_PNG" --out "$ICONSET/icon_128x128.png"    > /dev/null 2>&1
sips -z 256 256   "$SOURCE_PNG" --out "$ICONSET/icon_128x128@2x.png" > /dev/null 2>&1
sips -z 256 256   "$SOURCE_PNG" --out "$ICONSET/icon_256x256.png"    > /dev/null 2>&1
sips -z 512 512   "$SOURCE_PNG" --out "$ICONSET/icon_256x256@2x.png" > /dev/null 2>&1
sips -z 512 512   "$SOURCE_PNG" --out "$ICONSET/icon_512x512.png"    > /dev/null 2>&1
sips -z 1024 1024 "$SOURCE_PNG" --out "$ICONSET/icon_512x512@2x.png" > /dev/null 2>&1

# Convert to icns
echo "🔨 Converting to .icns..."
iconutil -c icns "$ICONSET" -o "$OUTPUT_ICNS"

# Clean up
rm -rf "$ICONSET"

echo "✅ Created $OUTPUT_ICNS"