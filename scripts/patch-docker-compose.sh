#!/usr/bin/env bash
# Patch the docker-compose file to use host networking for WSL2 compatibility
COMPOSE_FILE="$1"
if [ -z "$COMPOSE_FILE" ]; then
    echo "Usage: $0 <docker-compose-file>"
    exit 1
fi

# Replace host.docker.internal with 127.0.0.1 in node configs
for cfg in artifacts/node_config_*.toml artifacts/trusted_dealer_config.toml; do
    if [ -f "$cfg" ]; then
        sed -i 's/host.docker.internal/127.0.0.1/g' "$cfg"
    fi
done

# Add network_mode: host to each service and remove custom networks
python3 -c "
import yaml, sys

with open('$COMPOSE_FILE', 'r') as f:
    data = yaml.safe_load(f)

for svc_name, svc in data.get('services', {}).items():
    svc['network_mode'] = 'host'
    svc.pop('networks', None)
    svc.pop('extra_hosts', None)
    svc.pop('ports', None)

data.pop('networks', None)

with open('$COMPOSE_FILE', 'w') as f:
    yaml.dump(data, f, default_flow_style=False)
" 2>/dev/null

echo "Patched $COMPOSE_FILE for WSL2 host networking"
