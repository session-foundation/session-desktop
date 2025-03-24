#!/usr/bin/env bash

set -e

RELEASE_DIR="./dist"
ARCH=$1
echo "Setup release metadata for $ARCH architecture"

if [[ "$ARCH" == "arm64" ]]; then
  ls -t $RELEASE_DIR/latest-mac.yml | head -n 1 | xargs -I {} mv {} $RELEASE_DIR/latest-mac-$ARCH.yml
  echo "Created latest-mac-$ARCH.yml"
elif [[ "$ARCH" == "x64" ]]; then
  ls -t $RELEASE_DIR/latest-mac.yml | head -n 1 | xargs -I {} mv {} $RELEASE_DIR/latest-mac-x64.yml
  echo "Created latest-mac-x64.yml"
else
  echo "Unknown architecture: $ARCH"
  exit 1
fi
