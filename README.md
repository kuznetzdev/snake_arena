# Snake Arena

**Snake Arena** is a browser-based arena snake game with two modes:

1. **Single-player mode** through `index.html`.
2. **LAN multiplayer mode** through a local Node.js host.

The LAN mode is designed for two or more players in the same Wi‑Fi/local network, with AI bots always present in the arena.

## Fastest LAN Start

### Windows

Double-click:

```text
start-lan-windows.bat
```

The launcher starts the server and opens the host dashboard automatically.

### macOS

Double-click:

```text
start-lan-macos.command
```

If macOS blocks the file, run once:

```bash
chmod +x start-lan-macos.command
./start-lan-macos.command
```

### Linux / macOS terminal

```bash
chmod +x start-lan.sh
./start-lan.sh
```

### npm

```bash
npm start
```

`npm start` now launches the friendly LAN launcher, not just the raw server.

## What the Launcher Does

The launcher:

1. starts the local game server;
2. opens the host dashboard automatically;
3. shows LAN links that other players can open;
4. keeps the online game running while the launcher window is open.

The host dashboard is available at:

```text
http://localhost:3000/host.html
```

Players join from the same Wi‑Fi/local network using a shown LAN address, for example:

```text
http://192.168.1.25:3000
```

Each player opens the link on their own phone/computer, enters a name, and joins the arena.

## Important Browser Limitation

A normal browser page cannot directly start a Node.js server on the user’s computer. Browsers intentionally do not have permission to execute local programs.

That is why Snake Arena uses a launcher:

- the launcher starts the server;
- the UI shows the room/link;
- players join from the browser.

This is the closest safe flow to “Start network game from UI” without packaging the project as a desktop application.

## Features

- Large arena map.
- Single-player mode.
- LAN multiplayer for two or more players.
- AI bots in both single-player and LAN multiplayer modes.
- Deadly obstacles on the map.
- Health that slowly drains over time.
- Boost as a limited resource with no automatic regeneration.
- Health and boost restoration through eating food.
- Collisions with snakes, bodies, tails, obstacles, and arena borders.
- Mini-map.
- Leaderboard.
- Desktop and mobile controls.
- Host dashboard with shareable LAN links.

## Project Structure

```text
snake_arena/
├── index.html                 # Standalone single-player version
├── server.js                  # LAN multiplayer server
├── start-lan.js               # Cross-platform LAN launcher
├── start-lan-windows.bat      # Windows double-click launcher
├── start-lan-macos.command    # macOS double-click launcher
├── start-lan.sh               # macOS/Linux shell launcher
├── package.json
├── public/
│   ├── index.html             # LAN multiplayer client
│   └── host.html              # Host dashboard with LAN links
├── README.md
└── .gitignore
```

## Requirements

Single-player mode only needs a browser.

LAN multiplayer mode requires Node.js 18+.

No npm packages are required. The multiplayer server uses only built-in Node.js modules.

## Run Single-Player Mode

Open `index.html` directly in a browser.

Optional static server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Run LAN Multiplayer Manually

If you do not want to use the launcher:

```bash
node server.js
```

Then open:

```text
http://localhost:3000
```

## Multiplayer Architecture

The LAN mode uses an authoritative Node.js server:

- the server owns the world state;
- players send input to the server;
- the server updates snakes, food, obstacles, AI bots, resources, and collisions;
- clients poll the current arena snapshot and render it locally;
- no external backend or internet connection is required after the local server is running.

This is intentionally simple and robust for local network play.

## Controls

### Desktop

- Mouse — movement direction.
- `WASD` or arrow keys — alternative movement direction.
- Mouse click or `Space` — boost.
- `P` or `Esc` — pause in single-player mode.
- `Enter` on defeat screen — restart in single-player mode.

### Mobile

- Left joystick — movement direction.
- Right `⚡` button — boost.

## Resources

### Health

Health constantly drains over time. Boosting burns health faster. If health reaches zero, the snake dies.

### Boost

Boost does not regenerate automatically. When boost reaches zero, acceleration stops. Boost is restored by eating food.

## Current Status

The project is ready for manual testing in both modes:

- single-player directly from `index.html`;
- LAN multiplayer through the launcher or `npm start`.

## Recommended Next Steps

1. Package the launcher as a desktop app with Electron or Tauri for a true one-button native experience.
2. Add WebSocket transport for lower-latency multiplayer.
3. Add rooms and match settings.
4. Add automatic JavaScript validation.
5. Add graphics/control settings.
