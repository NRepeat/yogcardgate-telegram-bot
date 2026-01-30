# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and prisma schema (needed for postinstall prisma generate)
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

RUN npm run build

# Stage 2: Production runner
FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/prisma ./prisma

# Install production dependencies only
RUN npm ci --omit=dev

# Copy build output
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD sh -c "\
  until nc -z db 5432; do echo 'Waiting for database...'; sleep 2; done && \
  npx prisma migrate deploy && \
  node dist/src/main.js"
