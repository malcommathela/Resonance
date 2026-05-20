#!/bin/bash
# Resonance Quick Start Script

set -e

echo "🚀 Resonance — Quick Start"
echo "=========================="

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ required. Current: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Copy env files if they don't exist
if [ ! -f "apps/web/.env" ]; then
    echo ""
    echo "📝 Creating web .env..."
    cp apps/web/.env.example apps/web/.env
fi

if [ ! -f "apps/api/.env" ]; then
    echo ""
    echo "📝 Creating API .env..."
    cp apps/api/.env.example apps/api/.env
fi

# Start development
echo ""
echo "🎉 Starting development servers..."
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3001"
echo ""
npm run dev
