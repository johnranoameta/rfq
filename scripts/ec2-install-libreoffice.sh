#!/usr/bin/env bash
# Install LibreOffice on Amazon Linux 2023 (not in default dnf repos).
# See: https://docs.aws.amazon.com/linux/al2023/ug/al2023-libreoffice.html
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARCH="${LIBREOFFICE_ARCH:-x86_64}"
WORKDIR="${WORKDIR:-/tmp}/rfq-lo-install-$$"
mkdir -p "$WORKDIR"

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

download_file() {
  local url="$1"
  local dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 3 --retry-delay 5 --connect-timeout 30 -o "$dest" "$url" && return 0
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -q --show-progress --tries=3 --timeout=60 -O "$dest" "$url" && return 0
  fi
  return 1
}

# Stable versions that exist on download.documentfoundation.org (25.2.2 does NOT).
DEFAULT_VERSIONS=(
  "25.8.7"
  "25.2.5"
  "24.8.6"
  "24.8.4"
  "7.6.7.2"
)

build_urls() {
  local version="$1"
  local tarball="LibreOffice_${version}_Linux_x86-64_rpm.tar.gz"
  if [[ "$version" == 7.* ]]; then
    echo "https://downloadarchive.documentfoundation.org/libreoffice/old/${version}/rpm/${ARCH}/${tarball}"
  else
    echo "https://download.documentfoundation.org/libreoffice/stable/${version}/rpm/${ARCH}/${tarball}"
    echo "https://ftp.osuosl.org/pub/libreoffice/libreoffice/stable/${version}/rpm/${ARCH}/${tarball}"
  fi
}

install_from_documentfoundation_rpm() {
  echo "==> Amazon Linux 2023: installing LibreOffice from Document Foundation RPMs..."

  if command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y wget tar gzip curl libXinerama cups-libs dbus-libs cairo nss \
      2>/dev/null || sudo dnf install -y wget tar gzip curl libXinerama cups-libs
  fi

  local versions=()
  if [[ -n "${LIBREOFFICE_VERSION:-}" ]]; then
    versions+=("$LIBREOFFICE_VERSION")
  else
    versions=("${DEFAULT_VERSIONS[@]}")
  fi

  cd "$WORKDIR"
  local tarball="" url="" version="" ok=0

  for version in "${versions[@]}"; do
    tarball="LibreOffice_${version}_Linux_x86-64_rpm.tar.gz"
    echo "==> Trying version $version ..."
    while IFS= read -r url; do
      [[ -z "$url" ]] && continue
      echo "    $url"
      rm -f "$tarball"
      if download_file "$url" "$tarball" && [[ -s "$tarball" ]]; then
        ok=1
        break 2
      fi
    done < <(build_urls "$version")
  done

  if [[ "$ok" -ne 1 ]]; then
    echo "ERROR: Could not download LibreOffice RPM tarball." >&2
    echo "Set an explicit version, e.g.: LIBREOFFICE_VERSION=25.8.7 bash $0" >&2
    exit 1
  fi

  echo "==> Downloaded $(du -h "$tarball" | awk '{print $1}') — extracting..."
  tar -xzf "$tarball"
  local rpm_dir
  rpm_dir="$(ls -d LibreOffice_*_Linux_x86-64_rpm 2>/dev/null | head -1)"
  if [[ -z "$rpm_dir" || ! -d "$rpm_dir" ]]; then
    echo "ERROR: extracted RPM directory not found." >&2
    ls -la "$WORKDIR" >&2
    exit 1
  fi

  echo "==> Installing RPMs from $rpm_dir/RPMS/ (this may take a few minutes)..."
  sudo dnf install -y "$rpm_dir"/RPMS/*.rpm || sudo rpm -Uvh "$rpm_dir"/RPMS/*.rpm
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
