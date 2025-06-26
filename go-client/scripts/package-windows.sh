#!/bin/bash
# Package Windows binary with required DLLs

set -e

if [ $# -ne 2 ]; then
    echo "Usage: $0 <binary-path> <output-dir>"
    exit 1
fi

BINARY_PATH=$1
OUTPUT_DIR=$2
BINARY_NAME=$(basename "$BINARY_PATH")

# Create package directory
PACKAGE_DIR="${OUTPUT_DIR}/trunecord-windows-package"
mkdir -p "$PACKAGE_DIR"

# Copy binary
cp "$BINARY_PATH" "$PACKAGE_DIR/"

# Copy required DLLs from MSYS2
if [ -d "/mingw64/bin" ]; then
    # Copy opus and its dependencies
    cp /mingw64/bin/libopus-0.dll "$PACKAGE_DIR/" || true
    cp /mingw64/bin/libgcc_s_seh-1.dll "$PACKAGE_DIR/" || true
    cp /mingw64/bin/libwinpthread-1.dll "$PACKAGE_DIR/" || true
fi

# Create README
cat > "$PACKAGE_DIR/README.txt" << EOF
trunecord (Music to Discord) for Windows
========================================

This package includes all necessary files to run trunecord on Windows.

To run:
1. Double-click trunecord-windows-amd64.exe
2. Or run from Command Prompt: trunecord-windows-amd64.exe

The included DLL files are required for audio streaming support.
Do not remove them.

For more information, visit:
https://github.com/cahlchang/trunecord
EOF

# Create zip file
cd "$OUTPUT_DIR"

# Use PowerShell to create zip on Windows
if command -v powershell >/dev/null 2>&1; then
    powershell -Command "Compress-Archive -Path 'trunecord-windows-package/*' -DestinationPath 'trunecord-windows-amd64.zip' -Force"
elif command -v zip >/dev/null 2>&1; then
    zip -r "trunecord-windows-amd64.zip" "trunecord-windows-package/"
else
    echo "Error: Neither PowerShell nor zip command found. Cannot create archive."
    exit 1
fi

echo "Windows package created: ${OUTPUT_DIR}/trunecord-windows-amd64.zip"