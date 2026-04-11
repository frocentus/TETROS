# TETROS

Psychedelisches Tetris mit abstrakten Formen, generativer Musik und Neon-Visuals.

## Features

- **27 Entities** — 20 abstrakte Formen + 7 klassische Tetrominos
- **Generative Musik** — 5-Layer-Soundtrack, der sich mit jedem Level verändert
- **Combo-System** — Kettenbonus für aufeinanderfolgende Line-Clears
- **Countdown** — 3-2-1-GO vor jedem Spielstart
- **Highscores** — Top 10 mit Zeitfilter (Today / Week / All-Time)
- **Anti-Cheat** — serverseitige Score-Validierung
- **Rate-Limiting** — Spam-Schutz auf der API
- **Admin Panel** — passwortgeschütztes Dashboard mit Statistiken und Spielerliste
- **PWA** — installierbar als App, offline-fähig (Service Worker)
- **Responsive** — Desktop + Mobile mit Touch-Controls

## Quickstart

```bash
docker compose up -d
```

Das Spiel läuft auf **http://localhost:8181**

## Admin Panel

Erreichbar unter **http://localhost:8181/thevoid**

| | |
|---|---|
| **User** | `admin` |
| **Passwort** | `tetros_admin` |

Zeigt:
- Gesamtstatistiken (Spiele, Spieler, Scores, Lines, Level)
- Aktivitäts-Chart der letzten 30 Tage
- Alle Spieler mit Email, Spielanzahl, Best/Avg Score, letzter Aktivität

Zugangsdaten ändern via `docker-compose.yml` → `ADMIN_USER` / `ADMIN_PASS`.

## Projektstruktur

```
tetros/
├── docker-compose.yml
├── frontend/
│   ├── Dockerfile          # nginx
│   ├── nginx.conf          # reverse proxy → backend
│   ├── index.html
│   ├── style.css
│   ├── tetris.js
│   ├── sw.js               # Service Worker
│   ├── manifest.json       # PWA manifest
│   └── icon.svg
└── backend/
    ├── Dockerfile          # Node.js
    ├── package.json
    └── server.js           # Express API + Admin Panel
```

## Stack

| Komponente | Technologie |
|---|---|
| Frontend | Vanilla JS, Canvas, CSS |
| Backend | Node.js, Express |
| Datenbank | MySQL 8.0 |
| Webserver | nginx (reverse proxy) |
| Container | Docker Compose |

## API

| Endpoint | Methode | Beschreibung |
|---|---|---|
| `/api/scores` | GET | Top 10 Highscores (`?period=all\|week\|day`) |
| `/api/scores` | POST | Score einreichen (`{username, email?, score, level, lines}`) |
| `/api/health` | GET | Health check |
| `/admin` | GET | Admin Dashboard (Basic Auth) |

## Konfiguration

Alle Einstellungen via Environment-Variablen in `docker-compose.yml`:

| Variable | Default | Beschreibung |
|---|---|---|
| `DB_HOST` | `db` | MySQL Host |
| `DB_USER` | `tetros` | MySQL User |
| `DB_PASSWORD` | `tetros_secret` | MySQL Passwort |
| `ADMIN_USER` | `admin` | Admin Login |
| `ADMIN_PASS` | `tetros_admin` | Admin Passwort |
