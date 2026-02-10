FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/api/package.json packages/api/

RUN pnpm install --frozen-lockfile --prod

COPY packages/core/dist packages/core/dist/
COPY packages/api/dist packages/api/dist/

# Default session directory for local strategy
RUN mkdir -p /app/sessions
ENV SESSION_BASE_DIR=/app/sessions

EXPOSE 3000

CMD ["node", "packages/api/dist/index.js"]
