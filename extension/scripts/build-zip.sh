#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_ZIP="${ROOT_DIR}/../trunecord-extension.zip"

# Remove previous archive if it exists
rm -f "${OUTPUT_ZIP}"

# Create zip while excluding development artifacts
cd "${ROOT_DIR}"
zip -r "${OUTPUT_ZIP}" . \
  -x "node_modules/*" \
  -x "test/*" \
  -x "coverage/*" \
  -x "*.zip" \
  -x "scripts/*.sh~" \
  -x "*.log" \
  -x "*.tmp"

echo "Created ${OUTPUT_ZIP}"
