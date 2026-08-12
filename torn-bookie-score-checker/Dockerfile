FROM node:22-alpine
RUN apk add --no-cache unzip
WORKDIR /app
COPY TornBookie_ChatGPT_Score_Integration_v0.1.0.zip /tmp/score-app.zip
RUN unzip -q /tmp/score-app.zip -d /tmp/score-app \
    && cp -R /tmp/score-app/torn-bookie-chatgpt-score-app/. /app/ \
    && npm install --omit=dev
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
