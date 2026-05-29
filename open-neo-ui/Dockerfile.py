FROM python:3.12-slim
WORKDIR /app
COPY py/ ./
EXPOSE 8787
CMD ["python", "bridge.py"]
