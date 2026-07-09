# Flick — one Node process: Express API + SSE + MCP + the crayon SPA. No build step.
FROM node:20-slim

# ffmpeg: the Cutter assembles the real MP4 with it (the app runs without, but
# /api/health reports ffmpeg and the full path wants it).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# The server reads PORT (src/server/config.js) and listens on all interfaces.
# Override at run time: docker run -e PORT=... -p ...:...
ENV PORT=3010
EXPOSE 3010

CMD ["node", "src/server/index.js"]
