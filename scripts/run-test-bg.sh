#!/usr/bin/env bash
# Source profile to get PATH
source ~/.bashrc 2>/dev/null
source ~/.profile 2>/dev/null
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

cd ~/fog-build-tmp
RUN_ARCIUM_LOCALNET=1 arcium test > /tmp/arcium-test-3.log 2>&1
echo "EXIT: $?" >> /tmp/arcium-test-3.log
