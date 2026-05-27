FROM node:20-alpine

RUN apk add --no-cache ffmpeg python3 make g++

RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY packages/shared/package.json          ./packages/shared/
COPY packages/db/package.json              ./packages/db/
COPY packages/media/package.json           ./packages/media/
COPY packages/server/package.json          ./packages/server/
COPY packages/ui/package.json              ./packages/ui/
COPY packages/teleprompter-ui/package.json ./packages/teleprompter-ui/
COPY apps/web/package.json                 ./apps/web/
COPY apps/teleprompter/package.json        ./apps/teleprompter/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @showstack/web build
RUN pnpm --filter @showstack/teleprompter-app build

RUN mkdir -p /app/data/db /app/data/media /app/logs

EXPOSE 9876

CMD ["node", "packages/server/src/index.js"]
