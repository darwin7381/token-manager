FROM python:3.11-slim

WORKDIR /app

# 安裝 UV
RUN pip install uv

# 複製 requirements.txt
COPY backend/requirements.txt .

# 使用 UV 安裝依賴
RUN uv pip install --system -r requirements.txt

# 複製應用代碼
COPY backend/ .

# 設置端口
ENV PORT=8000
EXPOSE 8000

# 啟動命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
