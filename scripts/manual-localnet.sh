#!/usr/bin/env bash
# Manual localnet test to diagnose Arcium node startup
set -e

cd ~/fog-build-tmp

echo "=== Step 1: Start validator ==="
anchor localnet --skip-build > /tmp/validator.log 2>&1 &
VPID=$!
echo "Validator PID: $VPID"

echo "=== Step 2: Wait for validator ==="
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:8899 -X POST -H "Content-Type: application/json" \
       -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' 2>/dev/null | grep -q "ok"; then
        echo "Validator online after ${i}s"
        break
    fi
    sleep 1
done

echo "=== Step 3: Start Docker containers ==="
docker compose -f artifacts/docker-compose-arx-env.yml up -d 2>&1
echo "Containers started"

echo "=== Step 4: Wait for nodes ==="
for i in $(seq 1 60); do
    sleep 2
    echo "Check $i (${i}*2s)..."

    # Check health endpoint
    H0=$(curl -s http://127.0.0.1:9091/health 2>/dev/null || echo "no-response")
    H1=$(curl -s http://127.0.0.1:9092/health 2>/dev/null || echo "no-response")
    echo "  Node0 health: $H0"
    echo "  Node1 health: $H1"

    # Check container status
    docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | grep -i arc || true

    if echo "$H0" | grep -qi "ok\|healthy" && echo "$H1" | grep -qi "ok\|healthy"; then
        echo "Both nodes online!"
        break
    fi

    # Check for container crashes
    CRASHED=$(docker ps -a --filter "status=exited" --format "{{.Names}}" 2>/dev/null | grep -i arc || true)
    if [ -n "$CRASHED" ]; then
        echo "CRASHED containers: $CRASHED"
        for c in $CRASHED; do
            echo "=== Logs for $c ==="
            docker logs "$c" 2>&1 | tail -20
        done
        break
    fi
done

echo "=== Step 5: Container logs ==="
for c in $(docker ps -aq 2>/dev/null); do
    NAME=$(docker inspect --format="{{.Name}}" "$c" 2>/dev/null)
    echo "=== $NAME ==="
    docker logs "$c" 2>&1 | tail -30
done

echo "=== Step 6: Arx node file logs ==="
for f in artifacts/arx_node_logs/*; do
    [ -f "$f" ] && echo "=== $(basename $f) ===" && tail -20 "$f"
done

echo "=== Cleanup ==="
docker compose -f artifacts/docker-compose-arx-env.yml down 2>&1
kill $VPID 2>/dev/null
echo "Done"
