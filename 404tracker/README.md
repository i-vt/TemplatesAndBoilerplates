# 404 Tracker
<img width="3344" height="1344" alt="image" src="https://github.com/user-attachments/assets/9c7b49fb-2c20-4bfe-865c-f2a3d0ab7c41" />

A Node.js app that logs every 404 hit — capturing IP, anonymizing it, geolocating it,
and displaying it on a live-updating dashboard.

## Features

- 🚨 Logs every 404: IP address, requested URL, country, city, timestamp
- 🕵️ IP anonymization: replaces every digit with `*`, shows how many digits the IP has
- 🌍 Country flag emoji via geoip-lite (offline, no API key needed)
- 📊 Dashboard at `/dashboard` with:
  - Total hits / unique IPs / unique URLs counters
  - Top 10 probed paths (bar chart)
  - Top 10 source countries (bar chart)
  - Hits-per-hour histogram (24h)
  - Live log table (auto-refreshes every 10s)
- 💾 SQLite via better-sqlite3 (persisted via Docker volume)
- 🔒 Runs as non-root inside Docker on port **8742**

## Quick Start

```bash
# Build and run
docker compose up --build -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

## Endpoints

| Endpoint          | Description                              |
|-------------------|------------------------------------------|
| `/dashboard`      | Live monitoring dashboard                |
| `/health`         | JSON health check                        |
| `/trigger-test`   | Seeds 5 fake hits for demo purposes      |
| `/api/stats`      | JSON API used by dashboard for polling   |
| `/*` (any other)  | Returns 404 and logs the hit             |

## How it Works

1. All routes except `/dashboard`, `/health`, `/api/stats`, `/trigger-test` fall through to the catch-all middleware
2. The middleware extracts the real IP (handles `X-Forwarded-For`)
3. `geoip-lite` does an offline lookup for country + city
4. The hit is stored in SQLite
5. Dashboard polls `/api/stats?since=<lastId>` every 10 seconds for new rows

## IP Anonymization Example

| Real IP        | Anonymized     | Digit count |
|----------------|----------------|-------------|
| `8.8.8.8`      | `*.*.*.* `     | 4 digits    |
| `192.168.1.1`  | `***.***.*.*`  | 9 digits    |
| `185.220.101.45`| `***.***.***.** `| 11 digits  |

Dots and colons are preserved so the structure is visible without revealing the actual address.

## Data Persistence

The SQLite database is stored at `/app/data/tracker.db` inside the container,
mounted as a named Docker volume (`tracker-data`) so data survives container restarts.

## Port

The app runs on port **8742**. Change it in `docker-compose.yml` and `Dockerfile` if needed.
