#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=================================================="
echo "🚀 TrailWeave Development Server Runner"
echo "=================================================="

# Check virtual environment
if [ ! -d "backend/.venv" ]; then
    echo "Creating backend virtualenv..."
    python3 -m venv backend/.venv
    backend/.venv/bin/pip install --upgrade pip
    backend/.venv/bin/pip install -r backend/requirements.txt
fi

echo "1. Checking Backend Health & Supabase PostGIS..."
backend/.venv/bin/python backend/app/db/seed.py

echo "2. Running Backend Pytest Verification..."
backend/.venv/bin/pytest backend/tests -c backend/pytest.ini -v

echo "=================================================="
echo "To start services locally:"
echo "  Backend:  backend/.venv/bin/uvicorn app.main:app --app-dir backend --reload --port 8000"
echo "  Frontend: cd frontend && npm run dev"
echo "=================================================="
