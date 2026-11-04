#!/bin/bash
# Opens Black Valley: a small local server on this folder, then the browser.
cd "$(dirname "$0")" || exit 1
PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')
python3 serve.py "$PORT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
open "http://localhost:$PORT/"
echo "Black Valley:          http://localhost:$PORT/"
echo "Phone page on desktop: http://localhost:$PORT/?port=1   (portrait screens get it on their own)"
echo "(close this window to stop it)"
wait $SERVER
