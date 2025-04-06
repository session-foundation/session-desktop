#!/usr/bin/env bash

set -e

IDENTIFIER=$1
PLATFORM=$2
RELEASE_DIR="./dist"
OUTPUT_FILE="$RELEASE_DIR/latest-$PLATFORM.yml"

PARTIAL_FILES=()

if [[ "$PLATFORM" == "mac" ]]; then
  PARTIAL_FILES+=("$RELEASE_DIR/latest-mac-arm64-$IDENTIFIER.yml")
  PARTIAL_FILES+=("$RELEASE_DIR/latest-mac-x64-$IDENTIFIER.yml")
elif [[ "$PLATFORM" == "linux" ]]; then
  PARTIAL_FILES+=("$RELEASE_DIR/latest-linux-AppImage-$IDENTIFIER.yml")
  PARTIAL_FILES+=("$RELEASE_DIR/latest-linux-deb-$IDENTIFIER.yml")
  PARTIAL_FILES+=("$RELEASE_DIR/latest-linux-rpm-$IDENTIFIER.yml")
else
  echo "Unsupported platform: $PLATFORM"
  exit 1
fi

BASE_FILE="${PARTIAL_FILES[0]}"

echo "Combining release metadata for platform: $PLATFORM"

# Extract and write version (assuming both files have the same version)
echo "version: $(grep 'version:' "$BASE_FILE" | awk '{print $2}')" > "$OUTPUT_FILE"
echo "files:" >> "$OUTPUT_FILE"

for PARTIAL_FILE in "${PARTIAL_FILES[@]}"; do
  grep 'url:' "$PARTIAL_FILE" | while read -r line; do
    echo "  $line" >> "$OUTPUT_FILE"
    grep -A 2 "  $line" "$PARTIAL_FILE" | tail -n 2 >> "$OUTPUT_FILE"
  done
done

# Write the rest from BASE_FILE (assumes it is first in the list for all platforms)
echo "path: $(grep 'path:' "$BASE_FILE" | awk '{print $2}')" >> "$OUTPUT_FILE"
echo "sha512: $(grep 'sha512:' "$BASE_FILE" | tail -n 1 | awk '{print $2}')" >> "$OUTPUT_FILE"
echo "releaseDate: $(grep 'releaseDate:' "$BASE_FILE" | awk '{print $2}')" >> "$OUTPUT_FILE"

echo "Created $OUTPUT_FILE"