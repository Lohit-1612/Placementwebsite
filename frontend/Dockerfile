FROM node:24.11.0-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY scripts scripts
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_OIDC_URL=http://localhost:8081
ENV NEXT_PUBLIC_OIDC_URL=$NEXT_PUBLIC_OIDC_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM node:24.11.0-alpine
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node","server.js"]
