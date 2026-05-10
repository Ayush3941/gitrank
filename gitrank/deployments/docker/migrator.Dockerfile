FROM postgres:17-alpine

WORKDIR /app
COPY gitrank/deployments/migrations ./deployments/migrations
COPY gitrank/scripts/migrate.sh ./scripts/migrate.sh
RUN chmod 0555 ./scripts/migrate.sh

USER 65532:65532
ENTRYPOINT ["/app/scripts/migrate.sh"]
