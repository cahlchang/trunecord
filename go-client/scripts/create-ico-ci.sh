#!/bin/bash
# Create ICO file from PNG for Windows system tray (CI version)

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

# For CI environments, we can use Python with Pillow
python3 -c "
from PIL import Image
import os

source = '$SOURCE_IMAGE'
output = '$OUTPUT_DIR/icon.ico'

# Open the source image
img = Image.open(source)

# Create ICO with multiple sizes
img.save(output, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(f'Created {output}')
"