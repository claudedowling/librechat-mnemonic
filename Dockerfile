# syntax=docker/dockerfile:1

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime

# mnemonic shells out to git for every write, and to ca-certificates for
# embedding providers reached over https.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY --from=build /app/dist ./dist

# Bundled mnemonic, spawned over stdio. Override MNEMONIC_COMMAND to point at
# your own build, or set MNEMONIC_MODE=remote to use a hosted instance.
ENV MNEMONIC_COMMAND=/app/node_modules/.bin/mnemonic
ENV MNEMONIC_VAULT_PATH=/vault
ENV MNEMONIC_PROJECT_ROOT=/projects
ENV NODE_ENV=production
ENV PORT=8710

# mnemonic commits on every write and git refuses to commit without an identity.
ENV GIT_AUTHOR_NAME=librechat-mnemonic
ENV GIT_AUTHOR_EMAIL=librechat-mnemonic@localhost
ENV GIT_COMMITTER_NAME=librechat-mnemonic
ENV GIT_COMMITTER_EMAIL=librechat-mnemonic@localhost

RUN mkdir -p /vault /projects && chown -R node:node /vault /projects
USER node

EXPOSE 8710
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8710)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
