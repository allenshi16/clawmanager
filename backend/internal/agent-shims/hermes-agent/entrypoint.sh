#!/bin/bash

python3 /usr/local/bin/hermes-agent-shim.py &

exec /usr/bin/tini -g -- /opt/hermes/docker/entrypoint.sh "$@"
