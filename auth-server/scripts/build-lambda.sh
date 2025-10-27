#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/dist-lambda"

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

cp "${ROOT_DIR}/package.json" "${BUILD_DIR}/"
cp "${ROOT_DIR}/package-lock.json" "${BUILD_DIR}/"
cp "${ROOT_DIR}/index.js" "${BUILD_DIR}/"
cp "${ROOT_DIR}/lambda.js" "${BUILD_DIR}/"

pushd "${BUILD_DIR}" > /dev/null
npm ci --omit=dev
popd > /dev/null
