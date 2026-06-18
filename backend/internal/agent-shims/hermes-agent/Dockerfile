FROM nousresearch/hermes-agent:latest

RUN apt-get update && \
    apt-get install -y curl procps && \
    rm -rf /var/lib/apt/lists/*

COPY hermes-agent-shim.py /usr/local/bin/
RUN chmod +x /usr/local/bin/hermes-agent-shim.py

COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
