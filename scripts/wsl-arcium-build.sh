#!/usr/bin/env bash
# Canonical WSL build entrypoint for this repo.
#
# It standardizes the environment, builds Arcium circuits first, and then
# builds the Anchor program through the repo's wrapper so failures surface in
# one place with one toolchain.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Ensure HOME is set (critical for cargo-build-sbf)
if [ -z "${HOME:-}" ]; then
    export HOME
    HOME="$(eval echo ~"$(whoami)")"
    echo "[wsl-arcium-build] HOME was unset, now: $HOME"
fi

# Ensure Solana and Anchor toolchain paths are on PATH
SOLANA_BIN="$HOME/.local/share/solana/install/active_release/bin"
CARGO_BIN="$HOME/.cargo/bin"
RUSTUP_HOME="${RUSTUP_HOME:-$HOME/.rustup}"
CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
if [[ ":$PATH:" != *":$SOLANA_BIN:"* ]]; then
    export PATH="$SOLANA_BIN:$PATH"
fi
if [[ ":$PATH:" != *":$CARGO_BIN:"* ]]; then
    export PATH="$CARGO_BIN:$PATH"
fi
export HOME
export RUSTUP_HOME
export CARGO_HOME

SOLANA_VERSION_RAW="$(solana --version 2>/dev/null || true)"
ANCHOR_VERSION_RAW="$(anchor --version 2>/dev/null || true)"
ARCIUM_VERSION_RAW="$(arcium --version 2>/dev/null || true)"

if [[ ! "$ANCHOR_VERSION_RAW" =~ anchor-cli[[:space:]]0\.32\.1 ]]; then
    echo "[wsl-arcium-build] unsupported Anchor CLI: ${ANCHOR_VERSION_RAW:-not found}" >&2
    echo "[wsl-arcium-build] expected Anchor CLI 0.32.1 in WSL before running arcium build" >&2
    exit 1
fi

if [[ ! "$ARCIUM_VERSION_RAW" =~ arcium-cli[[:space:]]0\.8\. ]]; then
    echo "[wsl-arcium-build] unsupported Arcium CLI: ${ARCIUM_VERSION_RAW:-not found}" >&2
    echo "[wsl-arcium-build] expected Arcium CLI 0.8.x in WSL before running arcium build" >&2
    exit 1
fi

if [[ ! "$SOLANA_VERSION_RAW" =~ solana-cli[[:space:]]2\.(1|3)\. ]]; then
    echo "[wsl-arcium-build] unsupported Solana CLI: ${SOLANA_VERSION_RAW:-not found}" >&2
    echo "[wsl-arcium-build] expected Solana CLI 2.1.x or 2.3.x in WSL for this repo's rebuild path" >&2
    exit 1
fi

echo "[wsl-arcium-build] HOME=$HOME"
echo "[wsl-arcium-build] solana: $(which solana 2>/dev/null || echo 'not found')"
echo "[wsl-arcium-build] cargo-build-sbf: $(which cargo-build-sbf 2>/dev/null || echo 'not found')"
echo "[wsl-arcium-build] arcium: $(which arcium 2>/dev/null || echo 'not found')"
echo "[wsl-arcium-build] versions: $SOLANA_VERSION_RAW | $ANCHOR_VERSION_RAW | $ARCIUM_VERSION_RAW"
echo ""

COMMON_ENV=(
    "HOME=$HOME"
    "RUSTUP_HOME=$RUSTUP_HOME"
    "CARGO_HOME=$CARGO_HOME"
    "PATH=$PATH"
)

if [[ -n "${FOG_OF_WAR_CIRCUIT_BASE_URL:-}" ]]; then
    COMMON_ENV+=("FOG_OF_WAR_CIRCUIT_BASE_URL=$FOG_OF_WAR_CIRCUIT_BASE_URL")
fi

echo "[wsl-arcium-build] step 1/2: arcium build --skip-program $*"
env "${COMMON_ENV[@]}" arcium build --skip-program "$@"

echo ""
echo "[wsl-arcium-build] step 2/2: anchor program build"
exec env "${COMMON_ENV[@]}" bash "$SCRIPT_DIR/anchor-wrapper.sh" build
