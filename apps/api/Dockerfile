# Build da API para produção (Railway/Render/Fly.io). Corre a partir da raiz do
# monorepo: docker build -f apps/api/Dockerfile -t marca-ja-api .
FROM node:22-slim AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/database/package.json packages/database/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm install

COPY packages/database packages/database
COPY apps/api apps/api

RUN npm run --workspace=packages/database generate
RUN npm run --workspace=apps/api build

FROM node:22-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/database packages/database
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/package.json apps/api/package.json

EXPOSE 3000
# Aplica migrações pendentes e arranca o servidor — seguro correr em cada deploy.
CMD ["sh", "-c", "npx --prefix packages/database prisma migrate deploy --schema packages/database/prisma/schema.prisma && node apps/api/dist/server.js"]
