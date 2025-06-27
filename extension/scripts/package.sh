#!/bin/bash
# Package Chrome extension for distribution

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$EXTENSION_DIR")"
OUTPUT_DIR="${OUTPUT_DIR:-${ROOT_DIR}/dist}"

echo "Building Chrome extension..."
echo "Extension directory: $EXTENSION_DIR"
echo "Output directory: $OUTPUT_DIR"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Create a temporary directory for the extension
TEMP_DIR=$(mktemp -d)
echo "Using temporary directory: $TEMP_DIR"

# Copy extension files
echo "Copying extension files..."
cp -r "$EXTENSION_DIR"/* "$TEMP_DIR/" || true

# Remove unnecessary files
echo "Cleaning up unnecessary files..."
rm -rf "$TEMP_DIR/scripts" || true
rm -rf "$TEMP_DIR/test" || true
rm -rf "$TEMP_DIR/node_modules" || true
rm -f "$TEMP_DIR/package-lock.json" || true
rm -f "$TEMP_DIR/package.json" || true
rm -f "$TEMP_DIR/.gitignore" || true
rm -f "$TEMP_DIR/KNOWN_ISSUES.md" || true

# Create the zip file
ZIP_FILE="$OUTPUT_DIR/trunecord-extension.zip"
echo "Creating zip file: $ZIP_FILE"
cd "$TEMP_DIR"
zip -r "$ZIP_FILE" . -x "*.DS_Store" "*/.*"

# Clean up
rm -rf "$TEMP_DIR"

# Display result
if [ -f "$ZIP_FILE" ]; then
    echo "✅ Chrome extension packaged successfully: $ZIP_FILE"
    echo "Size: $(ls -lh "$ZIP_FILE" | awk '{print $5}')"
else
    echo "❌ Failed to create extension package"
    exit 1
fi