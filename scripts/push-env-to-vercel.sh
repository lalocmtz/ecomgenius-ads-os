#!/usr/bin/env bash
# Push env vars from .env to Vercel production + preview + development.
set -euo pipefail

VERCEL="${VERCEL:-$HOME/.npm-global/bin/vercel}"
ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# Vars we want in Vercel (skip locals like SEED_OWNER_ID).
VARS=(
  TURSO_DATABASE_URL
  TURSO_AUTH_TOKEN
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  CLERK_SECRET_KEY
  NEXT_PUBLIC_CLERK_SIGN_IN_URL
  NEXT_PUBLIC_CLERK_SIGN_UP_URL
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
  ANTHROPIC_API_KEY
  ANTHROPIC_MODEL
  CREATIVE_ANALYSIS_DAILY_LIMIT
)

for key in "${VARS[@]}"; do
  val=$(grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d '=' -f2-)
  if [ -z "$val" ]; then
    echo "  skip $key (empty)"
    continue
  fi
  for env in production preview development; do
    # Remove existing (idempotent)
    "$VERCEL" env rm "$key" "$env" --yes 2>/dev/null || true
    printf "%s" "$val" | "$VERCEL" env add "$key" "$env" >/dev/null 2>&1 && \
      echo "  ✓ $key → $env" || echo "  ✗ $key → $env"
  done
done
