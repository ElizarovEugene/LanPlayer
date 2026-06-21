#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Starting LanPlayer ==="

# Backend
cd "$SCRIPT_DIR/backend"
if [ ! -d ".venv" ]; then
    echo "[lanplayer] Creating backend venv..."
    python3 -m venv .venv
    "./.venv/bin/pip" install -q --upgrade pip
    "./.venv/bin/pip" install -q -r requirements.txt
fi
"./.venv/bin/python3" -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload &
BACKEND_PID=$!

# Frontend dev server
cd "$SCRIPT_DIR/frontend"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
if [ ! -d "node_modules" ]; then
    echo "[lanplayer] Installing frontend deps..."
    npm install
fi
npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID  → http://localhost:8002"
echo "Frontend PID: $FRONTEND_PID → http://localhost:5175"
echo ""
echo "Войдите как admin (пароль — ADMIN_PASSWORD из .env) и создайте пользователей через панель администратора в UI"
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
