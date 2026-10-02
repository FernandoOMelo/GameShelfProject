FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json eslint.config.js ./
COPY apps apps
COPY packages packages
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @gameshelf/contracts build && pnpm --filter @gameshelf/database build && pnpm --filter @gameshelf/api build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/web/package.json /app/apps/web/package.json
COPY --from=build /app/packages/ui/package.json /app/packages/ui/package.json
COPY --from=build /app/packages/config ./packages/config
COPY --from=build /app/packages/contracts ./packages/contracts
COPY --from=build /app/packages/database ./packages/database
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=build /app/packages/database/node_modules ./packages/database/node_modules
EXPOSE 3000
CMD ["pnpm", "--filter", "@gameshelf/api", "start"]
