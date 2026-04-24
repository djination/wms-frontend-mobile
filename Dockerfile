FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
EXPOSE 8081
CMD ["npx", "expo", "start", "--tunnel"]
