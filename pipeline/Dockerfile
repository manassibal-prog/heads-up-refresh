FROM python:3.12-slim
WORKDIR /app/pipeline
RUN pip install --no-cache-dir gspread google-auth
COPY refresh.py heads_up_call_list.sql config.json ./
ENV ENFORCE_HOURS=1
CMD ["python", "refresh.py"]
