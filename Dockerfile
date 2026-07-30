# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- front end --
# Built in its own stage so the dev toolchain (vite, typescript, @types) never
# reaches the runtime image.
FROM node:24-alpine AS client

WORKDIR /build
COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client

COPY client/ ./client/
RUN npm run build --prefix client

# ------------------------------------------------------------------ runtime --
FROM node:24-alpine AS runtime

# The app stores data through Node's built-in node:sqlite. Prove it works in
# this base image now, so a wrong Node version fails the build with a clear
# message instead of crashing on the first request.
RUN node -e "const { DatabaseSync } = require('node:sqlite'); \
  const db = new DatabaseSync(':memory:'); \
  db.exec('CREATE TABLE t (a INTEGER)'); \
  db.prepare('INSERT INTO t VALUES (?)').run(1); \
  if (db.prepare('SELECT a FROM t').get().a !== 1) throw new Error('sqlite roundtrip failed'); \
  console.log('node:sqlite OK on ' + process.version)"

ENV NODE_ENV=production
WORKDIR /app

# --ignore-scripts skips the postinstall that installs client dependencies —
# the front end is already built above.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY server/ ./server/
COPY scripts/ ./scripts/
COPY --from=client /build/client/dist ./client/dist

# The SQLite database and uploaded photos live here. Mount a volume over it or
# everything is lost when the container is replaced.
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME ["/app/data"]

USER node

# Bind every interface *inside* the container; what's actually exposed to the
# network is decided by how you publish the port.
ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

# /api/auth/session answers without a session cookie, so it works as a probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/auth/session') \
    .then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# No --env-file here on purpose. .env is deliberately excluded from the image
# (see .dockerignore) and values arrive as environment variables from compose,
# so --env-file-if-exists would only ever print Node's ".env not found.
# Continuing without it." on every boot — which reads like a failure and sends
# people hunting for a problem that doesn't exist.
CMD ["node", "server/index.js"]
