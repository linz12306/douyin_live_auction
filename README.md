# Douyin Live

## Local Docker Development

Start the project-local MySQL and Redis services:

```bash
docker compose up -d mysql redis
```

The MySQL service listens on `127.0.0.1:3307` and initializes the
`auction_db` database. The project Redis service listens on
`127.0.0.1:16380` with container name `douyin-live-redis`.

Run the backend in Docker as well:

```bash
docker compose --profile app up -d
```

When running the backend directly on the host, the default Redis setting is:

```bash
REDIS_ADDR=127.0.0.1:16380
```

Avoid using or stopping an unrelated legacy Redis service on
`127.0.0.1:16379`.

## Demo

For repeatable local presentation steps, see [docs/demo-readiness.md](docs/demo-readiness.md).
