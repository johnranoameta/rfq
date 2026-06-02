#!/usr/bin/env bash
# Install LibreOffice for Linux RFQ extraction (Amazon Linux 2023 / RHEL-like).
set -euo pipefail

if command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y libreoffice-headless libreoffice-writer
elif command -v yum >/dev/null 2>&1; then
  sudo yum install -y libreoffice-headless libreoffice-writer
elif command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y libreoffice-writer-nogui
else
  echo "No supported package manager (dnf/yum/apt-get)." >&2
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
  echo "LibreOffice installed but soffice binary not found." >&2
  exit 1
fi

echo "LibreOffice OK: $SOFFICE"
"$SOFFICE" --version

ENV_FILE="${1:-.env.local}"
LINE="RFQ_SOFFICE=$SOFFICE"
if [[ -f "$ENV_FILE" ]] && grep -q '^RFQ_SOFFICE=' "$ENV_FILE"; then
  sed -i.bak "s|^RFQ_SOFFICE=.*|$LINE|" "$ENV_FILE"
else
  echo "$LINE" >>"$ENV_FILE"
fi
echo "Wrote $LINE to $ENV_FILE"
