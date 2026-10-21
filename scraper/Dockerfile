# NochBot private crawler service (static Scrapling fetching; no browser binaries installed).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY nochbot_crawler ./nochbot_crawler

RUN useradd --create-home --uid 10001 crawler
USER crawler

EXPOSE 8080
CMD ["python", "-m", "nochbot_crawler"]
