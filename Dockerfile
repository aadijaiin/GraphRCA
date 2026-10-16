# One image: builds the frontend, then serves it and the API from FastAPI. FalkorDB runs separately.
FROM node:24-slim AS ui
WORKDIR /ui
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY queries/ queries/
COPY seed/ seed/
COPY eval/ eval/
COPY --from=ui /ui/dist frontend/dist
WORKDIR /app/backend
ENV PORT=8000
# Seed on start if the graph is empty or SEED_ON_START=1, then serve
CMD ["sh", "-c", "python ../seed/generate.py --if-missing && python ../seed/generate.py --tenant freshloop --if-missing && uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
