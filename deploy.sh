#!/bin/bash
# Deployment script for zakaz-3

set -e  # Exit on error

echo "🚀 Starting deployment of zakaz-3..."

# Configuration
APP_DIR="/home/makarenko/apps/zakaz-3"
REPO_URL="https://github.com/Makarenko444/zakaz-3.git"
BRANCH="claude/check-deployment-vm-011CUKpxfjRcBBSuLxQLeZBp"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create necessary directories
echo -e "${YELLOW}📁 Creating directories...${NC}"
mkdir -p ~/apps
mkdir -p ~/logs

# Clone or update repository
if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}📦 Updating repository...${NC}"
    cd "$APP_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
else
    echo -e "${YELLOW}📦 Cloning repository...${NC}"
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Install dependencies
echo -e "${YELLOW}📚 Installing dependencies...${NC}"
npm install --production=false

# Copy environment file if not exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚙️  Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${RED}⚠️  ВАЖНО: Отредактируйте .env файл с вашими настройками Supabase!${NC}"
    echo -e "${RED}   nano $APP_DIR/.env${NC}"
    read -p "Нажмите Enter после настройки .env..."
fi

# Build the application
echo -e "${YELLOW}🔨 Building application...${NC}"
npm run build

# Stop old PM2 process if exists
echo -e "${YELLOW}🛑 Stopping old process...${NC}"
pm2 stop zakaz-3 || true
pm2 delete zakaz-3 || true

# Start with PM2
echo -e "${YELLOW}▶️  Starting application with PM2...${NC}"
pm2 start ecosystem.config.js

# Save PM2 configuration
echo -e "${YELLOW}💾 Saving PM2 configuration...${NC}"
pm2 save

# Setup PM2 startup (if not already done)
echo -e "${YELLOW}🔄 Setting up PM2 startup...${NC}"
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u makarenko --hp /home/makarenko || true

echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${GREEN}Check status: pm2 status${NC}"
echo -e "${GREEN}View logs: pm2 logs zakaz-3${NC}"
echo -e "${GREEN}App running on: http://localhost:3001${NC}"
