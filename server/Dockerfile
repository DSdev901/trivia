FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
ENV SERVE_FRONTEND=0
EXPOSE 8787
CMD ["node", "index.js"]
