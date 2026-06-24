#!/usr/bin/env bash
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[32m'
RED='\033[31m'
YELLOW='\033[33m'
RESET='\033[0m'

info()  { echo -e "${BOLD}k8stui:${RESET} $*"; }
ok()    { echo -e "${GREEN}${BOLD}k8stui:${RESET} $*"; }
warn()  { echo -e "${YELLOW}${BOLD}k8stui:${RESET} $*"; }
error() { echo -e "${RED}${BOLD}k8stui:${RESET} $*" >&2; }

INSTALL_DIR="${HOME}/.local/bin"
REPO="AnakKucingTerbang/k8stui"

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "${os}" in
    Darwin)
      case "${arch}" in
        arm64) echo "macos-arm64" ;;
        x86_64) echo "macos-x64" ;;
        *) error "Unsupported macOS arch: ${arch}"; exit 1 ;;
      esac
      ;;
    Linux)
      case "${arch}" in
        x86_64) echo "linux-x64" ;;
        aarch64) echo "linux-arm64" ;;
        *) error "Unsupported Linux arch: ${arch}"; exit 1 ;;
      esac
      ;;
    *) error "Unsupported OS: ${os}"; exit 1 ;;
  esac
}

ensure_kubectl() {
  if command -v kubectl &>/dev/null; then
    ok "kubectl found: $(kubectl version --client 2>/dev/null | head -1)"
    return 0
  fi
  warn "kubectl is not installed."
  warn "k8stui requires kubectl to communicate with your cluster."
  warn "Install kubectl: https://kubernetes.io/docs/tasks/tools/"
  warn "Continuing install — k8stui will show a message when run without kubectl."
}

uninstall() {
  info "k8stui uninstaller"
  info "=================="
  echo ""
  if [ -f "${INSTALL_DIR}/k8stui" ]; then
    rm -f "${INSTALL_DIR}/k8stui"
    ok "Removed ${INSTALL_DIR}/k8stui"
  else
    warn "k8stui not found at ${INSTALL_DIR}/k8stui"
  fi
  echo ""
  ok "Uninstall complete!"
  echo ""
}

if [ "${1:-}" = "--uninstall" ]; then
  echo ""
  uninstall
  exit 0
fi

echo ""
info "k8stui installer"
info "================"
echo ""

info "Detecting platform..."
PLATFORM="$(detect_platform)"
ok "Detected platform: ${PLATFORM}"
echo ""

info "Fetching latest release..."
LATEST="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | cut -d'"' -f4)"
ok "Latest version: ${LATEST}"
echo ""

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST}/k8stui-${PLATFORM}"
info "Downloading k8stui-${PLATFORM}..."
mkdir -p "${INSTALL_DIR}"
curl -fsSL "${DOWNLOAD_URL}" -o "${INSTALL_DIR}/k8stui"
chmod +x "${INSTALL_DIR}/k8stui"
ok "Downloaded to ${INSTALL_DIR}/k8stui"
echo ""

ensure_kubectl
echo ""

case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    for rc in "${HOME}/.zshrc" "${HOME}/.bashrc"; do
      if [ -f "${rc}" ]; then
        if ! grep -qF '.local/bin' "${rc}" 2>/dev/null; then
          echo "" >> "${rc}"
          echo "export PATH=\"\${HOME}/.local/bin:\${PATH}\"" >> "${rc}"
          ok "Added ${INSTALL_DIR} to PATH in ${rc}"
          warn "Open a new terminal or run: source ${rc}"
        fi
        break
      fi
    done
    export PATH="${INSTALL_DIR}:${PATH}"
    ;;
esac

echo ""
ok "Installation complete!"
echo ""
info "Run k8stui:"
info "  ${BOLD}k8stui${RESET}"
echo ""
