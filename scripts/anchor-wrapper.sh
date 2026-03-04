#!/usr/bin/env bash
# Native Linux anchor wrapper for WSL

# Ensure native Linux node/npx is on PATH before Windows versions
export PATH="$HOME/.local/node-v20.20.0-linux-x64/bin:$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Log all invocations for debugging
echo "[anchor-wrapper] $(date): $*" >> /tmp/anchor-wrapper.log

case "$1" in
    build)
        shift
        # Use platform-tools v1.53 for edition2024 support, with proper sysroot
        PT="$HOME/.cache/solana/v1.53/platform-tools"
        export CC_sbpf_solana_solana="$PT/llvm/bin/clang"
        export CFLAGS_sbpf_solana_solana="--sysroot=$PT/llvm/sbpfv2 -isystem $PT/llvm/include"
        exec cargo-build-sbf --tools-version v1.53 -- -p fog_of_war_galactic_conquest "$@"
        ;;
    keys)
        if [ "$2" = "sync" ]; then
            DEPLOY_DIR="target/deploy"
            mkdir -p "$DEPLOY_DIR"
            if [ ! -f "$DEPLOY_DIR/fog_of_war_galactic_conquest-keypair.json" ]; then
                solana-keygen new --no-bip39-passphrase -o "$DEPLOY_DIR/fog_of_war_galactic_conquest-keypair.json" 2>/dev/null || true
            fi
            exit 0
        fi
        echo "anchor wrapper: unsupported keys subcommand: $2" >&2
        exit 1
        ;;
    --version|-V|version)
        echo "anchor-cli 0.32.1"
        ;;
    clean)
        cargo clean 2>/dev/null
        ;;
    localnet)
        shift
        echo "[anchor-wrapper] localnet args: $*" >> /tmp/anchor-wrapper.log

        # Parse Anchor.toml for program info
        TOML="Anchor.toml"
        PROGRAM_ID="BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE"
        PROGRAM_SO="target/deploy/fog_of_war_galactic_conquest.so"

        # Build validator args
        ARGS=()
        ARGS+=(--warp-slot 200)
        ARGS+=(--reset)
        ARGS+=(--bind-address 0.0.0.0)
        ARGS+=(--rpc-port 8899)

        # Load our program
        if [ -f "$PROGRAM_SO" ]; then
            ARGS+=(--bpf-program "$PROGRAM_ID" "$PROGRAM_SO")
        fi

        # Load arcium program
        ARCIUM_PROGRAM_ID="Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        ARCIUM_SO="artifacts/arcium_program_0.8.5.so"
        if [ -f "$ARCIUM_SO" ]; then
            ARGS+=(--bpf-program "$ARCIUM_PROGRAM_ID" "$ARCIUM_SO")
        fi

        # Load lighthouse program
        LIGHTHOUSE_SO="artifacts/lighthouse.so"
        if [ -f "$LIGHTHOUSE_SO" ]; then
            # Get lighthouse program ID from the SO or use known address
            LIGHTHOUSE_ID="L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95"
            ARGS+=(--bpf-program "$LIGHTHOUSE_ID" "$LIGHTHOUSE_SO")
        fi

        # Load all genesis account JSON files from artifacts/
        for acct_file in artifacts/*.json; do
            [ -f "$acct_file" ] || continue
            # Skip files that aren't account format (raw circuits, docker, etc)
            case "$acct_file" in
                *raw_circuit*|*docker*|*localnet/*) continue ;;
            esac
            # Extract pubkey from the JSON
            PUBKEY=$(python3 -c "import json; d=json.load(open('$acct_file')); print(d.get('pubkey',''))" 2>/dev/null)
            if [ -n "$PUBKEY" ] && [ "$PUBKEY" != "" ]; then
                ARGS+=(--account "$PUBKEY" "$acct_file")
            fi
        done

        echo "[anchor-wrapper] solana-test-validator ${ARGS[*]}" >> /tmp/anchor-wrapper.log

        # Start solana-test-validator in foreground (arcium expects this process to keep running)
        exec solana-test-validator "${ARGS[@]}"
        ;;
    test)
        shift
        echo "[anchor-wrapper] test args: $*" >> /tmp/anchor-wrapper.log

        # Parse flags
        SKIP_BUILD=false
        SKIP_DEPLOY=false
        SKIP_LOCAL_VALIDATOR=false
        for arg in "$@"; do
            case "$arg" in
                --skip-build) SKIP_BUILD=true ;;
                --skip-deploy) SKIP_DEPLOY=true ;;
                --skip-local-validator) SKIP_LOCAL_VALIDATOR=true ;;
            esac
        done

        # Parse --provider.cluster flag to set correct RPC URL
        CLUSTER=""
        for arg in "$@"; do
            case "$arg" in
                --provider.cluster) NEXT_IS_CLUSTER=true ;;
                *)
                    if [ "$NEXT_IS_CLUSTER" = "true" ]; then
                        CLUSTER="$arg"
                        NEXT_IS_CLUSTER=false
                    fi
                    ;;
            esac
        done

        # Load .env for private RPC endpoints (if available)
        if [ -f ".env" ]; then
            set -a
            source .env 2>/dev/null
            set +a
        fi

        echo "[anchor-wrapper] CLUSTER=$CLUSTER HELIUS_RPC_URL=${HELIUS_RPC_URL:-unset} ANCHOR_PROVIDER_URL=${ANCHOR_PROVIDER_URL:-unset}" >> /tmp/anchor-wrapper.log

        # Set environment variables that Anchor tests expect
        case "$CLUSTER" in
            devnet)  export ANCHOR_PROVIDER_URL="${QUICKNODE_RPC_URL:-${HELIUS_RPC_URL:-https://api.devnet.solana.com}}" ;;
            mainnet) export ANCHOR_PROVIDER_URL="https://api.mainnet-beta.solana.com" ;;
            *)       export ANCHOR_PROVIDER_URL="${ANCHOR_PROVIDER_URL:-http://127.0.0.1:8899}" ;;
        esac
        export ANCHOR_WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"

        echo "[anchor-wrapper] final ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL" >> /tmp/anchor-wrapper.log

        # Run the test script from Anchor.toml
        exec npx ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"
        ;;
    *)
        echo "anchor wrapper: unsupported command: $*" >&2
        exit 1
        ;;
esac
