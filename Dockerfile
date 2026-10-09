# ─────────────────────────────────────────────
# PRACTICAL 11 — Backend container
# Single-stage Node.js image for the Express API.
#
# The final image contains only production
# dependencies and the source files needed at
# runtime (no node_modules from the host, no .env).
#
# MongoDB connection comes from the MONGO_URI
# environment variable set in docker-compose.yml
# (mongodb://mongodb:27017/taskdb) — no credentials
# are baked into this image.
# ─────────────────────────────────────────────

# Node 22 (>= 20.19) satisfies the engine requirement
# of Mongoose 9: "node": ">=20.19.0"
FROM node:22-alpine

# Working directory inside the container
WORKDIR /app

# Copy dependency manifests FIRST so npm's layer cache
# only invalidates when package.json / lockfile change.
# npm ci installs exactly what package-lock.json says.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the backend source code
COPY . .

# The app listens on port 5000 (hardcoded in server.js).
# EXPOSE only documents it — actual publishing to the
# host happens in docker-compose.yml (ports: "5000:5000")
EXPOSE 5000

# Same start command as `npm start` in package.json
CMD ["npm", "start"]
