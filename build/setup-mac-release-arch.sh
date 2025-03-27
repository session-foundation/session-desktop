#!/usr/bin/env bash

set -e

RELEASE_DIR="./dist"
ARCH=$1
echo "Setup release metadata for $ARCH architecture"

if [[ "$ARCH" == "arm64" ]]; then
  mv $RELEASE_DIR/latest-mac.yml $RELEASE_DIR/latest-mac-$ARCH.yml
  echo "Created latest-mac-$ARCH.yml"
elif [[ "$ARCH" == "x64" ]]; then
  mv $RELEASE_DIR/latest-mac.yml $RELEASE_DIR/latest-mac-$ARCH.yml
  echo "Created latest-mac-$ARCH.yml"
else
  echo "Unknown architecture: $ARCH"
  exit 1
fi
