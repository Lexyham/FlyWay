FROM node:20-bookworm

WORKDIR /app

ENV NODE_ENV=development \
    PORT=3000 \
    PUPPETEER_CACHE_DIR=/opt/puppeteer

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npx puppeteer browsers install chrome --install-deps

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
