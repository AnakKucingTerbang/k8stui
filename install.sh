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
  info "Install Bun? [Y/n]"
  read -r response
  case "${response:-Y}" in
    [yY]|[yY][eE][sS]|"")
      info "Installing Bun via official installer..."
      curl -fsSL https://bun.sh/install | bash
      if [ -f "${HOME}/.bun/bin/bun" ]; then
        export PATH="${HOME}/.bun/bin:${PATH}"
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
    ok "kubectl found: $(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1)"
    return 0
  fi

  warn "kubectl is not installed."
  warn "k8stui requires kubectl to communicate with your cluster."
  warn "Install kubectl: https://kubernetes.io/docs/tasks/tools/"
  error "Cannot continue without kubectl."
  exit 1
}

create_wrapper() {
  mkdir -p "${INSTALL_DIR}"

  cat > "${WRAPPER}" <<'SCRIPT'
#!/usr/bin/env bash
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
    fi
  else
    warn "Could not detect shell rc file. Add this line to your shell config:"
    warn "  ${line}"
  fi

  export PATH="${INSTALL_DIR}:${PATH}"
}

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
info "Run k8stui:"
info "  ${BOLD}k8stui${RESET}"
echo ""
info "Or run directly without installing:"
info "  ${BOLD}bunx k8stui${RESET}"
echo ""
