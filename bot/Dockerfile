# Playwright(Chromium) + Node 봇 워커 + Python ddddocr 사이드카
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/* \
  && pip3 install --no-cache-dir ddddocr

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV HEADLESS=true
ENV OCR_PROVIDER=ddddocr
ENV DDDDOCR_URL=http://127.0.0.1:8000
ENV DDDDOCR_CHARSETS=0123456789
ENV BOT_CONCURRENCY=1
ENV CAPTCHA_MAX_RETRY=6

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bash", "start.sh"]
