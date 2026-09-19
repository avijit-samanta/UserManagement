#!/usr/bin/env bash
# Generates a self-signed TLS certificate/key pair for local HTTPS testing.
# Run from anywhere; output always goes to <repo root>/certs/.
#
#   npm run certs:generate
#
# The server (server/src/index.ts) picks these up automatically at
# certs/key.pem and certs/cert.pem if SSL_KEY_PATH/SSL_CERT_PATH aren't set.
# Browsers will still show a "not trusted" warning for a self-signed cert —
# that's expected for local dev; use a real certificate (or mkcert, see
# README.md "Running over HTTPS") to avoid the warning.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CERTS_DIR="$REPO_ROOT/certs"

mkdir -p "$CERTS_DIR"

# On Git Bash for Windows (MSYS), a single-leading-slash argument like
# "/CN=..." gets misread as a filesystem path and rewritten before openssl
# ever sees it. Doubling the leading slash ("//CN=...") opts that one
# argument out of the rewrite while leaving normal path arguments (-keyout,
# -out) converted correctly. No effect on macOS/Linux.
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$CERTS_DIR/key.pem" \
  -out "$CERTS_DIR/cert.pem" \
  -days 825 \
  -subj "//CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Generated $CERTS_DIR/key.pem and $CERTS_DIR/cert.pem (valid 825 days)."
