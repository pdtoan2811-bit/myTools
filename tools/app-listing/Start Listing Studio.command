#!/bin/bash
# Listing Studio (Shopify App Store graphics) — double-click launcher.
# Installs deps on first run, starts the studio, opens the browser.
cd "$(dirname "$0")" || { echo "Cannot find project folder."; read -r -p "Press Return to close."; exit 1; }
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
clear
echo "════════════════════════════════════════"
echo "  Listing Studio  (app-store graphics)"
echo "════════════════════════════════════════"
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm/node is not installed.  Install Node with:  brew install node"
  read -r -p "Press Return to close."; exit 1
fi

if [ ! -x "node_modules/.bin/astro" ]; then
  echo "📦 Installing dependencies (first run only)…"
  npm install || { echo "❌ npm install failed."; read -r -p "Press Return to close."; exit 1; }
  echo
fi

URL="http://localhost:4324"
( sleep 5; open "$URL" ) &
echo "🚀 Starting the studio  →  $URL"
echo "   (export PNGs from the studio or with:  npm run export)"
echo "   Leave this window open while you work · Ctrl+C to stop."
echo
# Call astro directly so we control the port (the npm script pins 4321).
./node_modules/.bin/astro dev --port 4324

echo; echo "Studio stopped."; read -r -p "Press Return to close."
