#!/bin/bash
# Server-side deployment script for zakaz-3
# This script can be called from GitHub Actions or run manually

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="$HOME/apps/zakaz-3"
BRANCH="${1:-main}"
BACKUP_DIR="$HOME/backups/zakaz-3"

echo -e "${GREEN}🚀 Starting deployment of zakaz-3...${NC}"

# Create backup
echo -e "${YELLOW}💾 Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
cp -r "$APP_DIR/.next" "$BACKUP_DIR/$BACKUP_NAME" 2>/dev/null || echo "No previous build to backup"

# Store current commit for potential rollback
cd "$APP_DIR"
PREVIOUS_COMMIT=$(git rev-parse HEAD)
echo -e "${YELLOW}📝 Previous commit: $PREVIOUS_COMMIT${NC}"

# Pull latest changes
echo -e "${YELLOW}📥 Pulling latest changes from branch: $BRANCH...${NC}"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

CURRENT_COMMIT=$(git rev-parse HEAD)
echo -e "${YELLOW}📝 Current commit: $CURRENT_COMMIT${NC}"

# Check if there are any changes
if [ "$PREVIOUS_COMMIT" = "$CURRENT_COMMIT" ]; then
    echo -e "${YELLOW}⚠️  No new changes detected${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci --production=false

# Build the application
echo -e "${YELLOW}🔨 Building application...${NC}"
if npm run build; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed! Rolling back...${NC}"
    git reset --hard "$PREVIOUS_COMMIT"
    if [ -d "$BACKUP_DIR/$BACKUP_NAME" ]; then
        rm -rf "$APP_DIR/.next"
        cp -r "$BACKUP_DIR/$BACKUP_NAME" "$APP_DIR/.next"
    fi
    exit 1
fi

# Restart PM2
echo -e "${YELLOW}♻️  Restarting PM2...${NC}"
pm2 restart zakaz-3

# Wait for application to start
echo -e "${YELLOW}⏳ Waiting for application to start...${NC}"
sleep 5

# Health check
echo -e "${YELLOW}🏥 Running health check...${NC}"
MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_CODE=$(curl -f -s -o /dev/null -w "%{http_code}" http://localhost:3001 || echo "000")

    if [[ "$HTTP_CODE" =~ ^(200|301|302|304)$ ]]; then
        echo -e "${GREEN}✅ Health check passed! (HTTP $HTTP_CODE)${NC}"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo -e "${YELLOW}⏳ Health check attempt $RETRY_COUNT/$MAX_RETRIES (HTTP $HTTP_CODE)${NC}"
        sleep 3
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Health check failed after $MAX_RETRIES attempts!${NC}"
    echo -e "${RED}Rolling back to previous version...${NC}"

    git reset --hard "$PREVIOUS_COMMIT"
    npm ci --production=false
    npm run build
    pm2 restart zakaz-3

    echo -e "${RED}Rollback completed. Check logs: pm2 logs zakaz-3${NC}"
    exit 1
fi

# Display status
echo -e "${GREEN}📊 PM2 Status:${NC}"
pm2 status

# Clean old backups (keep last 5)
echo -e "${YELLOW}🧹 Cleaning old backups...${NC}"
cd "$BACKUP_DIR"
ls -t | tail -n +6 | xargs -r rm -rf

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Application is running at: https://zakaz2.tomica.ru${NC}"
echo -e "${GREEN}📝 Commit: $CURRENT_COMMIT${NC}"
echo -e "${GREEN}📋 View logs: pm2 logs zakaz-3${NC}"
