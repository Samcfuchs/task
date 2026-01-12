FROM node:22-slim

WORKDIR /app
COPY . .

RUN npm install
RUN npm run build

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install -r requirements.txt --break-system-packages
RUN echo "precedence ::ffff:0:0/96  100" >> /etc/gai.conf


EXPOSE 8000
CMD [ "uvicorn", "main:app" ]
#CMD ["ping", "8.8.8.8"]
