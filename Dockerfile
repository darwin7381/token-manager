# 使用官方 Python 3.11 slim 映像
FROM python:3.11-slim

# 設置工作目錄
WORKDIR /app

# 安裝系統依賴（PostgreSQL 客戶端庫）
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 升級 pip
RUN pip install --upgrade pip

# 複製 requirements.txt
COPY backend/requirements.txt .

# 安裝 Python 依賴（移除 --no-cache-dir 以確保正確安裝）
RUN pip install -r requirements.txt

# 複製整個 backend 目錄
COPY backend/ .

# 複製啟動腳本
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# 暴露端口（Railway 會自動設置 $PORT 環境變數）
EXPOSE 8000

# 使用啟動腳本
CMD ["/app/start.sh"]

