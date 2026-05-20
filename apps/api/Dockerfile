FROM node:20-alpine

WORKDIR /app

COPY package*.json .
COPY apps/api/package*.json apps/api/
COPY packages/shared/package*.json packages/shared/

RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "apps/api/src/index.js"]
