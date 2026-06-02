#!/usr/bin/env bash
# Install LibreOffice for Linux RFQ extraction (Amazon Linux 2023 / RHEL-like).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

install_packages() {
  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y "$@" && return 0
  fi
  if command -v yum >/dev/null 2>&1; then
    sudo yum install -y "$@" && return 0
  fi
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y "$@" && return 0
  fi
  return 1
}

echo "==> Searching for LibreOffice packages..."
if command -v dnf >/dev/null 2>&1; then
  dnf search libreoffice 2>/dev/null | head -20 || true
fi

echo "==> Installing LibreOffice (trying common package sets)..."
INSTALLED=0
for pkgs in \
  "libreoffice-headless libreoffice-writer" \
  "libreoffice-writer libreoffice-core" \
  "libreoffice"; do
  if install_packages $pkgs; then
    INSTALLED=1
    echo "Installed: $pkgs"
    break
  fi
done

if [[ "$INSTALLED" -ne 1 ]]; then
  echo "ERROR: Could not install LibreOffice from distro repos." >&2
  echo "Try: sudo dnf search libreoffice" >&2
  exit 1
fi

SOFFICE=""
for c in /usr/lib/libreoffice/program/soffice /usr/lib64/libreoffice/program/soffice /usr/bin/soffice /usr/bin/libreoffice; do
  if [[ -x "$c" ]]; then
    SOFFICE="$c"
    break
  fi
done

if [[ -z "$SOFFICE" ]]; then
  echo "ERROR: LibreOffice packages installed but soffice binary not found." >&2
  find /usr -name soffice 2>/dev/null | head -5 || true
  exit 1
fi

echo "LibreOffice OK: $SOFFICE"
"$SOFFICE" --version

ENV_FILE="${1:-$ROOT/.env.local}"
touch "$ENV_FILE"
LINE="RFQ_SOFFICE=$SOFFICE"
if grep -q '^RFQ_SOFFICE=' "$ENV_FILE" 2>/dev/null; then
  sed -i.bak "s|^RFQ_SOFFICE=.*|$LINE|" "$ENV_FILE"
else
  echo "$LINE" >>"$ENV_FILE"
fi
grep -q '^RFQ_PYTHON=' "$ENV_FILE" 2>/dev/null || echo 'RFQ_PYTHON=python3' >>"$ENV_FILE"
echo "Updated $ENV_FILE:"
grep '^RFQ_' "$ENV_FILE" || true

echo ""
echo "Next: cd $ROOT && npm run build && pm2 restart rfq-ui"
echo "Check: curl -s http://127.0.0.1:3000/api/extraction/preflight | python3 -m json.tool"
