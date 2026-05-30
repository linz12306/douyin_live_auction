FROM golang:1.26-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server

FROM alpine:3.22

RUN adduser -D -H app \
    && mkdir -p /app/static/avatars /app/static/images \
    && chown -R app:app /app

WORKDIR /app

COPY --from=build /out/server /app/server

USER app

EXPOSE 8080

ENV SERVER_PORT=8080 \
    AVATAR_DIR=/app/static/avatars \
    IMAGE_DIR=/app/static/images

CMD ["/app/server"]
