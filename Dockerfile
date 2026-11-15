FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /app/private/uploads && chown -R node:node /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8098 DATA_DIR=/app/private
USER node
EXPOSE 8098
CMD ["node", "server.mjs"]

