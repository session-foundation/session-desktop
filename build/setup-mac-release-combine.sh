#!/usr/bin/env bash

set -e

RELEASE_DIR="./dist"
ARM64_FILE="$RELEASE_DIR/latest-mac-arm64.yml"
X64_FILE="$RELEASE_DIR/latest-mac-x64.yml"
OUTPUT_FILE="$RELEASE_DIR/latest-mac.yml"

echo "Combined release metadata from both architectures"

echo "version: $(grep 'version:' $ARM64_FILE | awk '{print $2}')" > $OUTPUT_FILE
echo "files:" >> $OUTPUT_FILE
grep 'url:' $ARM64_FILE | while read -r line; do
  echo "  $line" >> $OUTPUT_FILE
  grep -A 2 "  $line" $ARM64_FILE | tail -n 2 >> $OUTPUT_FILE
done
grep 'url:' $X64_FILE | while read -r line; do
  echo "  $line" >> $OUTPUT_FILE
  grep -A 2 "  $line" $X64_FILE | tail -n 2 >> $OUTPUT_FILE
done

echo "path: $(grep 'path:' $ARM64_FILE | awk '{print $2}')" >> $OUTPUT_FILE
echo "sha512: $(grep 'sha512:' $ARM64_FILE | tail -n 1 | awk '{print $2}')" >> $OUTPUT_FILE
echo "releaseDate: $(grep 'releaseDate:' $ARM64_FILE | awk '{print $2}')" >> $OUTPUT_FILE

echo "Created latest-mac.yml"
