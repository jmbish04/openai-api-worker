#!/bin/bash

# ============ Strict mode ============
set -o errexit -o pipefail
IFS=$'\n\t'

# ============ Colors ============
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

print_status()  { echo -e "${BLUE}$*${NC}"; }
print_success() { echo -e "${GREEN}$*${NC}"; }
print_warn()    { echo -e "${YELLOW}$*${NC}"; }
print_error()   { echo -e "${RED}$*${NC}"; }

echo -e "${GREEN}🚀 Complete Deployment Pipeline${NC}"
echo "========================================"
echo ""

# ============ Sanity checks ============
if [ ! -f "wrangler.toml" ]; then
  print_error "❌ wrangler.toml not found. Run from the project root."
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  print_error "❌ pnpm not found. Install pnpm first."
  exit 1
fi

# Install deps if needed (so TS + types are available before checks)
if [ ! -d "node_modules" ]; then
  print_warn "📦 Dependencies not found. Installing..."
  pnpm install
fi

# ============ TypeScript checks FIRST ============
print_status "📋 Step 0: TypeScript type-check"
echo "======================================"
# Use the build script which handles TypeScript compilation properly
set +o errexit
pnpm run build 2>&1 | tee ts-problems.txt
TS_EXIT=${PIPESTATUS[0]}
set -o errexit

if [ $TS_EXIT -ne 0 ]; then
  print_error "❌ TypeScript compilation failed (see ts-problems.txt)."
  echo ""
  print_warn "The following steps will be skipped:"
  echo "  • Git operations (commit & push)"
  echo "  • Cloudflare deployment"
  echo "  • Post-deployment tests"
  echo ""
  read -p "$(echo -e ${YELLOW}Do you want to continue with Git operations and deployment anyway? [y/N]: ${NC})" -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Deployment aborted due to TypeScript errors."
    print_warn "Please fix the TypeScript errors and run deploy.sh again."
    exit 1
  else
    print_warn "⚠️  Proceeding with deployment despite TypeScript errors..."
    print_warn "This may result in a broken deployment!"
  fi
else
  print_success "✅ TypeScript checks passed."
fi

echo ""

# ============ Git ops ============
print_status "📋 Step 0: Git Operations"
echo "======================================"

GIT_REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
if [ -z "$GIT_REMOTE_URL" ]; then
  print_warn "No 'origin' remote configured. Skipping push after commit."
fi

if [ -n "$(git status --porcelain)" ]; then
  print_warn "📝 Changes detected, committing to Git..."
  git add -A
  COMMIT_MSG="${1:-Deploy: $(date +'%Y-%m-%d %H:%M:%S') - Auto-deployment with latest changes}"
  print_warn "💭 Commit message: ${COMMIT_MSG}"
  git commit -m "$COMMIT_MSG"

  if [ -n "$GIT_REMOTE_URL" ]; then
    print_status "🔄 Pushing to GitHub..."
    CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
    if git rev-parse --abbrev-ref "@{u}" >/dev/null 2>&1; then
      git push
    else
      git push --set-upstream origin "$CURRENT_BRANCH"
    fi
    print_success "✅ Successfully pushed to GitHub"
  else
    print_warn "⚠️  Skipped push (no remote 'origin')."
  fi
else
  print_success "✅ No changes to commit"
fi

echo ""

# ============ Update OpenAPI models ============
print_status "📋 Step 1: Update OpenAPI models"
echo "======================================"

pnpm run update-openapi-models

# ============ Cloudflare deploy ============
print_status "📋 Step 2: Cloudflare Deployment"
echo "======================================"

npx wrangler deploy

print_success "✅ Deployment complete!"
echo ""

# ============ Tests ============
print_status "📋 Step 3: Running Tests (npm run test:post-deploy)"
echo "======================================"
npm run test:post-deploy

# ============ Summary ============
echo ""
print_status "📍 Deployment Summary:"
WORKER_NAME="$(grep -E '^name *= *' wrangler.toml | head -1 | cut -d'=' -f2 | tr -d ' \"')"
echo "🌐 Worker URL: https://${WORKER_NAME}.hacolby.workers.dev"
echo "🔗 GitHub: ${GIT_REMOTE_URL:-Not configured}"
echo "📊 Branch: $(git branch --show-current)"
echo "🕐 Deployed: $(date)"
echo ""
print_success "🚀 Ready to use!"