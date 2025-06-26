#!/bin/bash
# Create a simple DMG background image with instructions

OUTPUT_DIR="${1:-./}"
BG_FILE="${OUTPUT_DIR}/dmg-background.png"

# Create a simple background using ImageMagick if available
if command -v convert >/dev/null 2>&1; then
    convert -size 500x300 xc:white \
        -font Arial -pointsize 18 \
        -draw "text 250,50 'trunecord Installation'" \
        -font Arial -pointsize 14 \
        -draw "text 250,100 'Drag trunecord.app to Applications folder'" \
        -draw "text 250,130 'Then open from Applications'" \
        -strokewidth 2 -stroke black -fill none \
        -draw "line 180,160 180,180" \
        -draw "line 180,180 320,180" \
        -draw "line 320,180 320,160" \
        -draw "polygon 310,165 320,160 330,165" \
        "${BG_FILE}"
    echo "Created DMG background: ${BG_FILE}"
else
    echo "ImageMagick not installed. Skipping background creation."
fi