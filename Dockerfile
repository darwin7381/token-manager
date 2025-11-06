# 使用官方 Python 3.11 slim 映像
FROM python:3.11-slim

# 設置工作目錄
WORKDIR /app

# 複製 requirements.txt
COPY backend/requirements.txt .

# 安裝 Python 依賴
RUN pip install --no-cache-dir -r requirements.txt

# 複製整個 backend 目錄
COPY backend/ .

# 暴露端口（Railway 會自動設置 $PORT 環境變數）
EXPOSE 8000

# 啟動命令
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

