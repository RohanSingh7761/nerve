#!/usr/bin/env bash
set -e

echo "Starting Nerve Backend & Frontend..."

trap 'kill $(jobs -p)' EXIT

# Start backend
(cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8000) &

# Start frontend
(cd nerve_client && npm run dev) &

wait
