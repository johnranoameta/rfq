#!/usr/bin/env bash
# Install LibreOffice on Amazon Linux 2023 (not in default dnf repos).
# See: https://docs.aws.amazon.com/linux/al2023/ug/al2023-libreoffice.html
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LO_VERSION="${LIBREOFFICE_VERSION:-25.2.2}"
ARCH="${LIBREOFFICE_ARCH:-x86_64}"
TMPDIR="${TMPDIR:-/tmp}/rfq-lo-install-$$"
mkdir -p "$TMPDIR"
trap 'rm -rf "$TMPDIR"' EXIT

install_from_dnf() {
  if ! command -v dnf >/dev/null 2>&1; then
    return 1
  fi
  for pkgs in \
    "libreoffice-headless libreoffice-writer" \
    "libreoffice-writer libreoffice-core" \
    "libreoffice"; do
    # shellcheck disable=SC2086
    if sudo dnf install -y $pkgs 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

install_from_documentfoundation_rpm() {
  echo "==> Amazon Linux 2023: installing LibreOffice from Document Foundation RPMs..."
  echo "    Version: $LO_VERSION ($ARCH)"

  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y wget tar gzip libXinerama cups-libs dbus-libs cairo nss \
      2>/dev/null || sudo dnf install -y wget tar gzip libXinerama cups-libs
  fi

  TARBALL="LibreOffice_${LO_VERSION}_Linux_x86-64_rpm.tar.gz"
  URL="https://download.documentfoundation.org/libreoffice/stable/${LO_VERSION}/rpm/${ARCH}/${TARBALL}"

  cd "$TMPDIR"
  if [[ ! -f "$TARBALL" ]]; then
    echo "==> Downloading $URL"
    wget -q --show-progress -O "$TARBALL" "$URL" || {
      echo "Download failed. Try another version: LIBREOFFICE_VERSION=24.8.7 bash $0" >&2
      exit 1
    }
  fi

  tar -xzf "$TARBALL"
  RPM_DIR="$(echo LibreOffice_"${LO_VERSION}"*_Linux_x86-64_rpm)"
  if [[ ! -d "$RPM_DIR" ]]; then
    RPM_DIR="$(ls -d LibreOffice_*_Linux_x86-64_rpm 2>/dev/null | head -1)"
  fi
  if [[ ! -d "$RPM_DIR" ]]; then
    echo "ERROR: extracted RPM directory not found under $TMPDIR" >&2
    ls -la "$TMPDIR" >&2
    exit 1
  fi

  echo "==> Installing RPMs from $RPM_DIR/RPMS/"
  sudo dnf install -y "$RPM_DIR"/RPMS/*.rpm || sudo rpm -Uvh "$RPM_DIR"/RPMS/*.rpm
}

find_soffice_binary() {
  local c
  for c in \
    /opt/libreoffice*/program/soffice \
    /usr/lib/libreoffice/program/soffice \
    /usr/lib64/libreoffice/program/soffice \
    /usr/bin/soffice \
    /usr/bin/libreoffice; do
    # shellcheck disable=SC2086
    for match in $c; do
      if [[ -x "$match" ]]; then
        echo "$match"
        return 0
      fi
    done
  done
  find /opt -maxdepth 4 -name soffice -type f -executable 2>/dev/null | head -1
}

echo "==> Checking distro packages (optional)..."
if install_from_dnf; then
  echo "Installed LibreOffice from dnf."
else
  echo "No LibreOffice in dnf repos (normal on Amazon Linux 2023)."
  install_from_documentfoundation_rpm
fi

SOFFICE="$(find_soffice_binary || true)"
if [[ -z "$SOFFICE" ]]; then
  echo "ERROR: soffice not found after install." >&2
  find /opt /usr -name 'soffice*' 2>/dev/null | head -10 >&2 || true
  exit 1
fi

cd "$ROOT"
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
echo "Next:"
echo "  cd $ROOT && npm run build && pm2 restart rfq-ui"
echo "  curl -s http://127.0.0.1:3000/api/extraction/preflight | python3 -m json.tool"
