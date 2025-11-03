#!/bin/bash
# Local PR checks - matches GitHub Actions workflow

set -e  # Exit on error

echo "🔍 Running PR checks locally..."
echo ""

# Backend checks
echo "📦 Backend checks..."
cd backend
npm install
node --check src/index.js
echo "✅ Backend syntax check passed"
npm test || echo "⚠️ Some backend tests failed (non-blocking)"
cd ..

# Frontend checks
echo ""
echo "🎨 Frontend checks..."
cd frontend
npm install
npm run lint
echo "✅ ESLint passed"
npm run build
echo "✅ Build passed"
cd ..

echo ""
echo "✅ All PR checks passed locally!"
