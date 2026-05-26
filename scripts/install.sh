#!/usr/bin/env bash
# AIFR Install Script (macOS / Linux)
# Run: curl -fsSL https://raw.githubusercontent.com/GeziP/aifr/main/scripts/install.sh | bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}AIFR - AI Flight Recorder Installer${NC}"
echo -e "${CYAN}====================================${NC}"

# Check Node.js
if ! command -v node &>/dev/null; then
    echo -e "${RED}Error: Node.js is required but not installed.${NC}"
    echo -e "${YELLOW}Install from https://nodejs.org/ (v20 or later)${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')

if [ "$MAJOR" -lt 20 ]; then
    echo -e "${RED}Error: Node.js v20+ required, found $NODE_VERSION${NC}"
    exit 1
fi

echo -e "${GREEN}[OK] Node.js $NODE_VERSION${NC}"

# Check pnpm
if ! command -v pnpm &>/dev/null; then
    echo -e "${YELLOW}Installing pnpm...${NC}"
    npm install -g pnpm
fi

PNPM_VERSION=$(pnpm --version)
echo -e "${GREEN}[OK] pnpm $PNPM_VERSION${NC}"

# Clone if not already in repo
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}Cloning AIFR repository...${NC}"
    git clone https://github.com/GeziP/aifr.git
    cd aifr
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
pnpm install

# Build
echo -e "${YELLOW}Building packages...${NC}"
pnpm build

echo ""
echo -e "${GREEN}AIFR installed successfully!${NC}"
echo ""
echo -e "${CYAN}Quick start:${NC}"
echo "  pnpm aifr init          # Initialize in a project"
echo "  pnpm aifr start         # Start recording"
echo "  pnpm aifr import claude # Import Claude sessions"
echo "  cd apps/web && pnpm dev # Start web UI"
