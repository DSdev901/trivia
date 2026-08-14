FROM node:22-bookworm-slim
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm install --omit=dev
COPY server/ .
ENV NODE_ENV=production
ENV SERVE_FRONTEND=0
CMD ["node", "index.js"]
