#!/usr/bin/env sh
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Please install Node.js 18+ and run this file again."
  echo "https://nodejs.org/"
  read -r -p "Press Enter to close..."
  exit 1
fi

node start-lan.js
read -r -p "Press Enter to close..."
