FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/shared/src packages/shared/src
COPY apps/api/src apps/api/src

RUN sed -i 's|"node dist/index.js"|"tsx src/index.ts"|' apps/api/package.json

EXPOSE 4000

CMD ["npm", "start", "--workspace=apps/api"]
