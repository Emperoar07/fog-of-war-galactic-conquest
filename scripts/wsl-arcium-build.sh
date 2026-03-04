#!/usr/bin/env bash
# Wrapper for `arcium build` in WSL that ensures HOME and Solana env vars
# are properly set before invoking the build.
#
# Usage (from WSL, inside the repo root):
#   bash scripts/wsl-arcium-build.sh
#
# Background:
#   `arcium build` and `anchor build` both fail in WSL with:
#     cargo_build_sbf: Can't get home directory path: environment variable not found
#   This happens because the inner cargo-build-sbf subprocess loses the HOME
#   environment variable. This wrapper ensures it is always present.

set -euo pipefail

# Ensure HOME is set (critical for cargo-build-sbf)
if [ -z "${HOME:-}" ]; then
    export HOME
    HOME="$(eval echo ~"$(whoami)")"
    echo "[wsl-arcium-build] HOME was unset, now: $HOME"
fi

# Ensure Solana and Anchor toolchain paths are on PATH
SOLANA_BIN="$HOME/.local/share/solana/install/active_release/bin"
CARGO_BIN="$HOME/.cargo/bin"
if [[ ":$PATH:" != *":$SOLANA_BIN:"* ]]; then
    export PATH="$SOLANA_BIN:$PATH"
fi
if [[ ":$PATH:" != *":$CARGO_BIN:"* ]]; then
    export PATH="$CARGO_BIN:$PATH"
fi

echo "[wsl-arcium-build] HOME=$HOME"
echo "[wsl-arcium-build] solana: $(which solana 2>/dev/null || echo 'not found')"
echo "[wsl-arcium-build] cargo-build-sbf: $(which cargo-build-sbf 2>/dev/null || echo 'not found')"
echo "[wsl-arcium-build] arcium: $(which arcium 2>/dev/null || echo 'not found')"
echo ""

# Run arcium build with HOME guaranteed in environment
exec arcium build "$@"
