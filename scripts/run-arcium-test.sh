#!/usr/bin/env bash
set -x
cd ~/fog-build-tmp
rm -f /tmp/arcium-test.log
RUN_ARCIUM_LOCALNET=1 arcium test 2>&1 | tee /tmp/arcium-test.log
echo "EXIT_CODE: $?" >> /tmp/arcium-test.log
