FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_SYNC_SERVICE_URL=http://localhost:3001
ENV VITE_SYNC_SERVICE_URL=$VITE_SYNC_SERVICE_URL
# Either "service" (queue in the local service) or "browser" (queue in IndexedDB).
ARG VITE_LOCAL_STORE=service
ENV VITE_LOCAL_STORE=$VITE_LOCAL_STORE
RUN npm run build

FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
