FROM oven/bun:1-slim

RUN apt-get update && apt-get install -y \
    chromium fonts-liberation libnss3 libatk-bridge2.0-0 \
    libdrm2 libxkbcommon0 libgbm1 python3 python3-pip \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
RUN mkdir -p /app/data

EXPOSE 3000 8787
CMD ["bun", "run", "src/index.ts"]
