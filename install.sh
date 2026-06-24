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

AUTO_YES=0

for arg in "$@"; do
  case "${arg}" in
    --yes|-y) AUTO_YES=1 ;;
    --uninstall) ;;
  esac
done

has() { command -v "$1" &>/dev/null; }

shell_rc=""
detect_shell_rc() {
  if [ -n "${ZDOTDIR:-}" ] && [ -f "${ZDOTDIR}/.zshrc" ]; then
    shell_rc="${ZDOTDIR}/.zshrc"
  elif [ -f "${HOME}/.zshrc" ]; then
    shell_rc="${HOME}/.zshrc"
  elif [ -f "${HOME}/.bashrc" ]; then
    shell_rc="${HOME}/.bashrc"
  fi
}

ensure_bun() {
  if has bun; then
    ok "Bun found: $(bun --version)"
    return 0
  fi

  warn "Bun is required but not installed."
  if [ "${AUTO_YES:-0}" = "1" ]; then
    info "Auto-accepting Bun installation (--yes flag)."
    response="Y"
  else
    info "Install Bun? [Y/n]"
    read -r response </dev/tty 2>/dev/null || response="Y"
  fi
  case "${response:-Y}" in
    [yY]|[yY][eE][sS]|"")
      info "Installing Bun via official installer..."
      curl -fsSL https://bun.sh/install | bash
      if [ -f "${HOME}/.bun/env" ]; then
        source "${HOME}/.bun/env"
        ok "Bun installed: $(bun --version)"
      else
        error "Bun installation failed. Please install manually: https://bun.sh"
        exit 1
      fi
      ;;
    *)
      error "Bun is required. Install it from https://bun.sh and re-run this script."
      exit 1
      ;;
  esac
}

ensure_kubectl() {
  if has kubectl; then
    ok "kubectl found: $(kubectl version --client 2>/dev/null | head -1)"
    return 0
  fi

  warn "kubectl is not installed."
  warn "k8stui requires kubectl to communicate with your cluster."
  warn "Install kubectl: https://kubernetes.io/docs/tasks/tools/"
  warn "Continuing install — k8stui will show a message when run without kubectl."
}

install_k8stui() {
  info "Installing k8stui globally via Bun..."
  bun install -g k8stui
  ok "k8stui installed successfully."
}

uninstall_k8stui() {
  info "k8stui uninstaller"
  info "=================="
  echo ""
  bun remove -g k8stui
  ok "Uninstall complete!"
  echo ""
}

if echo "$@" | grep -qE '(^|\s)--uninstall(\s|$)'; then
  echo ""
  uninstall_k8stui
  exit 0
fi

echo ""
info "k8stui installer"
info "================"
echo ""

ensure_bun
echo ""
ensure_kubectl
echo ""

install_k8stui
echo ""

ok "Installation complete!"
echo ""
info "Run k8stui:"
info "  ${BOLD}k8stui${RESET}"
echo ""
