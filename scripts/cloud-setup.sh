#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Projet-art
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) { console.error("Node.js 24 ou supérieur est requis."); process.exit(1); }'
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run build
