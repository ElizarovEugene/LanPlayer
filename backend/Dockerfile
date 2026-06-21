FROM python:3.13-slim

RUN useradd -m -u 1000 app

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN mkdir -p /data/covers && chown -R app:app /data

USER app

ENV DATABASE_URL=sqlite:////data/lanplayer.db
ENV COVERS_DIR=/data/covers
ENV PYTHONUNBUFFERED=1

EXPOSE 8002

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
