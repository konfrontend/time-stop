# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app

# Install every workspace dependency once; the server build needs domain and db compiled too.
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/domain/package.json packages/domain/
COPY packages/db/package.json packages/db/
COPY apps/server/package.json apps/server/
COPY apps/desktop/package.json apps/desktop/
RUN npm ci --ignore-scripts

FROM deps AS build
COPY tsconfig.json turbo.json ./
COPY packages/tsconfig packages/tsconfig
COPY packages/domain packages/domain
COPY packages/db packages/db
COPY apps/server apps/server
RUN npx turbo build --filter=@time-stop/server

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json /app/.npmrc ./
COPY --from=build /app/packages/domain/package.json packages/domain/
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/packages/db/package.json packages/db/
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/apps/server/package.json apps/server/
COPY --from=build /app/apps/server/dist apps/server/dist
RUN npm ci --omit=dev --ignore-scripts --workspace=@time-stop/server && npm cache clean --force
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "apps/server/dist/index.js"]
