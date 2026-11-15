FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node . .
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8098 DATA_DIR=/app/private
USER node
EXPOSE 8098
VOLUME ["/app/private"]
CMD ["node", "server.mjs"]
