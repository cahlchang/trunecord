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

# Copy license file
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/../LICENSE-THIRD-PARTY" ]; then
    cp "$SCRIPT_DIR/../LICENSE-THIRD-PARTY" "$PACKAGE_DIR/"
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

License information for included third-party libraries can be found in
LICENSE-THIRD-PARTY file.

For more information, visit:
https://github.com/cahlchang/trunecord
EOF

# Create zip file
cd "$OUTPUT_DIR"
zip -r "trunecord-windows-amd64.zip" "trunecord-windows-package/"

echo "Windows package created: ${OUTPUT_DIR}/trunecord-windows-amd64.zip"