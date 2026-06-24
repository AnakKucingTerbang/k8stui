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
WRAPPER="${INSTALL_DIR}/k8stui"
AUTO_YES=0
PATH_UPDATED=0

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

path_needs_update() {
  case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) return 1 ;;
    *) return 0 ;;
  esac
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

create_wrapper() {
  mkdir -p "${INSTALL_DIR}"

  cat > "${WRAPPER}" <<'SCRIPT'
#!/usr/bin/env bash
if ! command -v bun &>/dev/null; then
  echo "k8stui: Bun is required but not found on PATH." >&2
  echo "k8stui: Install it from https://bun.sh or run: source ~/.bun/env" >&2
  exit 1
fi
exec bunx k8stui "$@"
SCRIPT

  chmod +x "${WRAPPER}"
  ok "Wrapper script created: ${WRAPPER}"
}

update_path() {
  if ! path_needs_update; then
    return 0
  fi

  detect_shell_rc

  local line="export PATH=\"\${HOME}/.local/bin:\${PATH}\""

  if [ -n "${shell_rc}" ] && [ -f "${shell_rc}" ]; then
    if grep -qF '.local/bin' "${shell_rc}" 2>/dev/null; then
      ok "${INSTALL_DIR} already in ${shell_rc}"
    else
      echo "" >> "${shell_rc}"
      echo "${line}" >> "${shell_rc}"
      ok "Added ${INSTALL_DIR} to PATH in ${shell_rc}"
      PATH_UPDATED=1
    fi
  else
    warn "Could not detect shell rc file. Add this line to your shell config:"
    warn "  ${line}"
  fi

  export PATH="${INSTALL_DIR}:${PATH}"
}

uninstall() {
  info "k8stui uninstaller"
  info "=================="
  echo ""

  if [ -f "${WRAPPER}" ]; then
    rm -f "${WRAPPER}"
    ok "Removed ${WRAPPER}"
  else
    warn "Wrapper script not found at ${WRAPPER}"
  fi

  echo ""
  ok "Uninstall complete!"
  echo ""
  info "Note: ${INSTALL_DIR} was left on your PATH (other tools may use it)."
  info "To remove it manually, edit your shell rc file and delete the line:"
  info "  export PATH=\"\${HOME}/.local/bin:\${PATH}\""
  echo ""
}

if echo "$@" | grep -qE '(^|\s)--uninstall(\s|$)'; then
  echo ""
  uninstall
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

info "Creating k8stui command..."
create_wrapper
echo ""

info "Ensuring ${INSTALL_DIR} is on PATH..."
update_path
echo ""

ok "Installation complete!"
echo ""
if [ "${PATH_UPDATED}" = "1" ]; then
  warn "PATH was updated in your shell rc file."
  warn "Open a new terminal or run: source ${shell_rc}"
  warn "Then run k8stui:"
  echo ""
  info "  ${BOLD}k8stui${RESET}"
else
  info "Run k8stui:"
  info "  ${BOLD}k8stui${RESET}"
fi
echo ""
info "Or run directly without installing:"
info "  ${BOLD}bunx k8stui${RESET}"
echo ""
