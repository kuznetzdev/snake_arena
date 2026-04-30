#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

echo "Starting Snake Arena LAN..."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Please install Node.js 18+ and run this file again."
  echo "https://nodejs.org/"
  exit 1
fi

node start-lan.js
