FROM node:20-slim AS base

RUN npm i -g corepack@latest

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.8.0 --activate

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y python3 build-essential libsqlite3-dev

# Files needed for pnpm install
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Remove build dependencies to keep the image small
RUN apt-get remove -y python3 build-essential libsqlite3-dev && apt-get clean && rm -rf /var/lib/apt/lists/*

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during the build
ENV NEXT_TELEMETRY_DISABLED 1

RUN pnpm build:next

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install runtime dependencies for sqlite3
RUN apt-get update && apt-get install -y libsqlite3-0 && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app

RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 12005

ENV PORT 12005
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]