FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

RUN npm install

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

EXPOSE 3001

CMD ["node", "apps/api/src/index.js"]