#!/usr/bin/env bash
# Starts the Veritrace backend (port 8000) and frontend (port 3000) together.
#
#   ./start.sh            use the provider set in backend/.env (Groq, then the backup Groq key, then Gemini)
#   ./start.sh gemini     Gemini first (20 requests a day on the free tier), Groq as fallback
#
# Ctrl+C stops both.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
PROVIDER="${1:-}"
PIDS=()

die() { echo "start.sh: $*" >&2; exit 1; }

[[ -x "$BACKEND/.venv/bin/uvicorn" ]] || die "backend/.venv is missing; see 'Run the backend' in README.md."
[[ -f "$BACKEND/.env" ]] || die "backend/.env is missing; copy backend/.env.example and add the keys."
[[ -d "$FRONTEND/node_modules" ]] || (cd "$FRONTEND" && npm install)
[[ -f "$FRONTEND/.env.local" ]] || cp "$FRONTEND/.env.example" "$FRONTEND/.env.local"

for port in 8000 3000; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    die "port $port is already in use; stop whatever is running there first."
  fi
done

# npm and Next.js start child processes of their own, so stop the whole tree.
kill_tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill "$1" 2>/dev/null || true
}
cleanup() {
  trap - INT TERM EXIT
  echo; echo "Stopping..."
  for pid in "${PIDS[@]}"; do kill_tree "$pid"; done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

case "$PROVIDER" in
  "") ;;
  gemini) export LLM_PROVIDER=gemini LLM_FALLBACK=groq ;;
  groq) export LLM_PROVIDER=groq LLM_FALLBACK=groq_backup,gemini ;;
  *) die "unknown provider '$PROVIDER'; use groq or gemini." ;;
esac

echo "Starting the backend on http://localhost:8000 ..."
(cd "$BACKEND" && exec .venv/bin/uvicorn app.main:app --port 8000) &
PIDS+=($!)

# The first start loads the embedding and NLI models, which takes a little while.
for _ in $(seq 120); do
  curl -sf http://localhost:8000/api/health >/dev/null && break
  kill -0 "${PIDS[-1]}" 2>/dev/null || die "the backend exited; see the log above."
  sleep 1
done
curl -s http://localhost:8000/api/health | "$BACKEND/.venv/bin/python" -c \
  'import json,sys; h=json.load(sys.stdin); l=h["llm"]; print("Backend %s: %s / %s, %d documents" % (h["status"], l["provider"], l["model"], h["documents"]))' || true

echo "Starting the frontend on http://localhost:3000 ..."
(cd "$FRONTEND" && exec npm run dev -- --port 3000) &
PIDS+=($!)

echo
echo "Veritrace is running: open http://localhost:3000  (Ctrl+C to stop)"
wait -n "${PIDS[@]}" 2>/dev/null || true
