FROM node:22-slim

WORKDIR /app
COPY . .

RUN npm install
RUN npm run build

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN pip install -r requirements.txt --break-system-packages

EXPOSE 8000
CMD [ "uvicorn", "main:app" ]
