FROM node:22-bookworm-slim AS web
WORKDIR /src
COPY package.json package-lock.json tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm ci && npm run build

FROM python:3.12-slim-bookworm
WORKDIR /app
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server/spherex.py .
COPY --from=web /src/dist ./dist
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn spherex:app --host 0.0.0.0 --port ${PORT}"]
