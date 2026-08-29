# Opsional: build image custom (tidak wajib — docker-stack.yml memakai node:20-slim langsung)
FROM node:20-slim

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV APP_DIR=/app/app \
    DATA_DIR=/app/data \
    PORT=3000

VOLUME ["/app/data"]

EXPOSE 3000

ENTRYPOINT ["sh", "/entrypoint.sh"]