#!/bin/bash
# Create ICO file from PNG for Windows system tray

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
SOURCE_IMAGE="$PROJECT_ROOT/resource/image.png"
OUTPUT_DIR="$SCRIPT_DIR/../internal/icon"

if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "Source image not found: $SOURCE_IMAGE"
    exit 1
fi

echo "Creating Windows ICO from $SOURCE_IMAGE"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Create multiple sizes for ICO (Windows requires multiple resolutions)
sizes=(16 32 48 64 128 256)
for size in "${sizes[@]}"; do
    echo "Creating ${size}x${size} image..."
    sips -z $size $size "$SOURCE_IMAGE" --out "$TEMP_DIR/icon_${size}.png" >/dev/null 2>&1
done

# Use ImageMagick to create ICO if available
if command -v convert >/dev/null 2>&1; then
    echo "Creating ICO file with ImageMagick..."
    convert "$TEMP_DIR/icon_16.png" "$TEMP_DIR/icon_32.png" "$TEMP_DIR/icon_48.png" \
            "$TEMP_DIR/icon_64.png" "$TEMP_DIR/icon_128.png" "$TEMP_DIR/icon_256.png" \
            "$OUTPUT_DIR/icon.ico"
    echo "Created $OUTPUT_DIR/icon.ico"
else
    echo "ImageMagick not found. Please install it to create ICO files:"
    echo "  brew install imagemagick"
    exit 1
fi