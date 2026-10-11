#!/usr/bin/env bash
set -e

echo "=== Setting up Nerve ==="

if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
fi

echo "Setting up Python virtual environment..."
cd backend
python3 -m venv .venv || python -m venv .venv
source .venv/bin/activate || source .venv/Scripts/activate
pip install -e .

echo "Setting up Frontend..."
cd ../nerve_client
npm install

echo "=== Setup complete! Run ./scripts/dev.sh to launch Nerve ==="
