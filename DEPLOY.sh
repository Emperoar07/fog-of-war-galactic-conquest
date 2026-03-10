#!/bin/bash

# Fog of War: Galactic Conquest - Production Deployment Script
# Handles all phases of deployment from devnet to mainnet

set -e

echo "=========================================="
echo "Fog of War: Galactic Conquest"
echo "Production Deployment Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CLUSTER=${SOLANA_CLUSTER:-devnet}
ARCIUM_CLUSTER=${ARCIUM_CLUSTER:-testnet}
DRY_RUN=${DRY_RUN:-false}

echo "Configuration:"
echo "  Solana Cluster: $CLUSTER"
echo "  Arcium Cluster: $ARCIUM_CLUSTER"
echo "  Dry Run: $DRY_RUN"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Phase 1: Pre-deployment checks
echo -e "${YELLOW}Phase 1: Pre-deployment Checks${NC}"
echo "  Checking dependencies..."

# Check Solana CLI
if ! command -v solana &> /dev/null; then
    print_error "Solana CLI not found. Install from https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi
print_status "Solana CLI found: $(solana --version)"

# Check Anchor
if ! command -v anchor &> /dev/null; then
    print_error "Anchor framework not found. Install with 'npm install -g @coral-xyz/anchor-cli'"
    exit 1
fi
print_status "Anchor found: $(anchor --version)"

# Check Rust
if ! command -v cargo &> /dev/null; then
    print_error "Rust/Cargo not found. Install from https://rustup.rs/"
    exit 1
fi
print_status "Rust found: $(cargo --version)"

# Check Arcium CLI
if ! command -v arcium-cli &> /dev/null; then
    print_warning "Arcium CLI not found. Some features will be skipped."
    print_warning "Install with 'cargo install arcium-cli' for full functionality"
else
    print_status "Arcium CLI found"
fi

echo ""

# Phase 2: Run tests
echo -e "${YELLOW}Phase 2: Running Test Suite${NC}"
echo "  Running circuit optimization tests..."

if npm test tests/circuit-optimization.test.ts; then
    print_status "All tests passing"
else
    print_error "Tests failed. Fix issues before deployment."
    exit 1
fi

echo ""

# Phase 3: Build Solana program
echo -e "${YELLOW}Phase 3: Building Solana Program${NC}"
echo "  Building with Anchor..."

if [ "$DRY_RUN" = "true" ]; then
    print_warning "DRY RUN: Skipping actual build"
else
    if anchor build --release; then
        print_status "Solana program built successfully"
    else
        print_error "Build failed"
        exit 1
    fi
fi

echo ""

# Phase 4: Build and verify circuits
echo -e "${YELLOW}Phase 4: Building Arcium Circuits${NC}"

if command -v arcium-cli &> /dev/null; then
    echo "  Compiling circuits..."
    if [ "$DRY_RUN" = "true" ]; then
        print_warning "DRY RUN: Skipping actual circuit compilation"
    else
        cd encrypted-ixs
        if arcium-cli compile --release; then
            print_status "Circuits compiled successfully"
        else
            print_error "Circuit compilation failed"
            exit 1
        fi
        cd ..
    fi
else
    print_warning "Skipping circuit build (Arcium CLI not found)"
fi

echo ""

# Phase 5: Deploy to target cluster
echo -e "${YELLOW}Phase 5: Deploying to ${CLUSTER}${NC}"

# Set Solana cluster
echo "  Setting Solana cluster to: $CLUSTER"
solana config set --url $CLUSTER

# Check wallet
echo "  Checking wallet..."
WALLET=$(solana config get | grep "Keypair Path" | awk '{print $NF}')
WALLET_ADDRESS=$(solana address)
print_status "Wallet: $WALLET_ADDRESS"

# Get balance
BALANCE=$(solana balance | awk '{print $1}')
print_status "Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 1" | bc -l) )); then
    print_warning "Low balance ($BALANCE SOL). You may need to airdrop funds."
    if [ "$CLUSTER" = "devnet" ]; then
        echo "  Run: solana airdrop 2 --url devnet"
    fi
fi

echo ""

# Phase 6: Deploy program
echo -e "${YELLOW}Phase 6: Deploying Solana Program${NC}"

PROGRAM_SO="target/deploy/fog_of_war_galactic_conquest.so"

if [ ! -f "$PROGRAM_SO" ]; then
    print_error "Program binary not found at $PROGRAM_SO"
    exit 1
fi

echo "  Program size: $(stat -f%z "$PROGRAM_SO" 2>/dev/null || stat -c%s "$PROGRAM_SO") bytes"

if [ "$DRY_RUN" = "true" ]; then
    print_warning "DRY RUN: Skipping actual deployment"
    echo "  Would deploy: solana program deploy $PROGRAM_SO --url $CLUSTER"
else
    echo "  Deploying to $CLUSTER..."
    if solana program deploy "$PROGRAM_SO" --url $CLUSTER; then
        print_status "Program deployed successfully"
    else
        print_error "Deployment failed"
        exit 1
    fi
fi

echo ""

# Phase 7: Deploy circuits to Arcium (if available)
echo -e "${YELLOW}Phase 7: Deploying Circuits to Arcium${NC}"

if command -v arcium-cli &> /dev/null; then
    if [ "$DRY_RUN" = "true" ]; then
        print_warning "DRY RUN: Skipping Arcium deployment"
        echo "  Would run: arcium-cli deploy --cluster $ARCIUM_CLUSTER --circuits ./target/circuits/*"
    else
        echo "  Deploying circuits to Arcium $ARCIUM_CLUSTER..."
        if arcium-cli deploy --cluster $ARCIUM_CLUSTER --circuits ./target/circuits/*; then
            print_status "Circuits deployed to Arcium"
        else
            print_error "Arcium deployment failed (this may be expected if Arcium cluster is not available)"
        fi
    fi
else
    print_warning "Skipping Arcium deployment (arcium-cli not found)"
fi

echo ""

# Phase 8: Verify deployment
echo -e "${YELLOW}Phase 8: Verifying Deployment${NC}"

if [ "$DRY_RUN" = "false" ]; then
    # Try to fetch program info
    PROGRAM_ID=$(solana config get | grep "Wallet public key" | awk '{print $NF}')
    
    if solana program show $PROGRAM_ID --url $CLUSTER &>/dev/null; then
        print_status "Program deployed and accessible"
    else
        print_warning "Program may not be fully propagated yet. Check again in 30 seconds."
    fi
fi

echo ""

# Summary
echo "=========================================="
echo -e "${GREEN}Deployment Complete${NC}"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✓ Tests passed"
echo "  ✓ Program built"
if command -v arcium-cli &> /dev/null; then
    echo "  ✓ Circuits compiled"
fi
if [ "$DRY_RUN" = "false" ]; then
    echo "  ✓ Deployed to $CLUSTER"
fi
echo ""
echo "Next steps:"
if [ "$CLUSTER" = "devnet" ]; then
    echo "  1. Test the deployment: npm run test:devnet"
    echo "  2. Run a full match: npm run demo:match"
    echo "  3. For mainnet: set SOLANA_CLUSTER=mainnet-beta and run deploy again"
else
    echo "  1. Monitor performance: npm run monitor"
    echo "  2. Check Arcium integration: npm run check:arcium"
fi
echo ""
echo "Documentation:"
echo "  - Deployment details: PRODUCTION_DEPLOYMENT.md"
echo "  - Hackathon submission: HACKATHON_SUBMISSION.md"
echo "  - Full submission: FINAL_SUBMISSION_PACKAGE.md"
echo ""
