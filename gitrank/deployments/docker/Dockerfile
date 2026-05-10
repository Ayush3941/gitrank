FROM golang:1.26.3-alpine AS build

ARG SERVICE

WORKDIR /src
COPY gitrank ./gitrank

WORKDIR /src/gitrank
RUN test -n "${SERVICE}"
RUN go work sync
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" \
    -o /out/service "./services/${SERVICE}/cmd/${SERVICE}"

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/service /app/service

USER nonroot:nonroot
ENTRYPOINT ["/app/service"]
