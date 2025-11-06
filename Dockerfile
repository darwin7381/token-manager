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

# 暴露端口
EXPOSE 8000

# 啟動命令（Railway 會自動設置 PORT 環境變數）
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
