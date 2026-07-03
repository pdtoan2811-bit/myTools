#!/bin/bash
# Guide Studio (review & edit user guides) — double-click launcher.
# Installs deps on first run, starts the studio server, opens the browser.
cd "$(dirname "$0")" || { echo "Cannot find project folder."; read -r -p "Press Return to close."; exit 1; }
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
clear
echo "════════════════════════════════════════"
echo "  Guide Studio  (user-guide review)"
echo "════════════════════════════════════════"
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm/node is not installed.  Install Node with:  brew install node"
  read -r -p "Press Return to close."; exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies (first run only)…"
  npm install || { echo "❌ npm install failed."; read -r -p "Press Return to close."; exit 1; }
  echo
fi

export PORT=4319
URL="http://localhost:$PORT"
( sleep 4; open "$URL" ) &
echo "🚀 Starting Guide Studio  →  $URL"
echo "   Review guides here; author new ones in Claude Code with the /guide skill."
echo "   Leave this window open while you work · Ctrl+C to stop."
echo
npm run studio

echo; echo "Studio stopped."; read -r -p "Press Return to close."
