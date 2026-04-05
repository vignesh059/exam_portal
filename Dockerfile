# syntax=docker/dockerfile:1

FROM node:20-alpine

# Security: run as non-root
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Install dependencies first (better layer cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

USER app

EXPOSE 3000

CMD ["node", "server.js"]