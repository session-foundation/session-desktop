#!/usr/bin/env bash

set -e

IDENTIFIER=$1
RELEASE_DIR="./dist"
APPIMAGE_FILE="$RELEASE_DIR/latest-linux-AppImage-$IDENTIFIER.yml"
DEB_FILE="$RELEASE_DIR/latest-linux-deb-$IDENTIFIER.yml"
RPM_FILE="$RELEASE_DIR/latest-linux-rpm-$IDENTIFIER.yml"

# Note: freebsd doesn't do auto update via electron-updater
# and so doesn't generate a latest-linux
# FREEBSD_FILE="$RELEASE_DIR/latest-linux-arm64-$IDENTIFIER.yml"
OUTPUT_FILE="$RELEASE_DIR/latest-linux.yml"

echo "Combined release metadata from all linux builds"

echo "version: $(grep 'version:' $APPIMAGE_FILE | awk '{print $2}')" > $OUTPUT_FILE
echo "files:" >> $OUTPUT_FILE
grep 'url:' $APPIMAGE_FILE | while read -r line; do
  echo "  $line" >> $OUTPUT_FILE
  grep -A 2 "  $line" $APPIMAGE_FILE | tail -n 2 >> $OUTPUT_FILE
done
grep 'url:' $DEB_FILE | while read -r line; do
  echo "  $line" >> $OUTPUT_FILE
  grep -A 2 "  $line" $DEB_FILE | tail -n 2 >> $OUTPUT_FILE
done
grep 'url:' $DEB_FILE | while read -r line; do
  echo "  $line" >> $OUTPUT_FILE
  grep -A 2 "  $line" $DEB_FILE | tail -n 2 >> $OUTPUT_FILE
done
grep 'url:' $FREEBSD_FILE | while read -r line; do
  echo "  $line" >> $OUTPUT_FILE
  grep -A 2 "  $line" $FREEBSD_FILE | tail -n 2 >> $OUTPUT_FILE
done

echo "path: $(grep 'path:' $APPIMAGE_FILE | awk '{print $2}')" >> $OUTPUT_FILE
echo "sha512: $(grep 'sha512:' $APPIMAGE_FILE | tail -n 1 | awk '{print $2}')" >> $OUTPUT_FILE
echo "releaseDate: $(grep 'releaseDate:' $APPIMAGE_FILE | awk '{print $2}')" >> $OUTPUT_FILE

echo "Created $OUTPUT_FILE"
