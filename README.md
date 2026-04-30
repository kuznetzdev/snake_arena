# Snake Arena

**Snake Arena** is a browser-based arena snake game. The project now supports two modes:

1. **Single-player mode** through `index.html`.
2. **LAN multiplayer mode** through `server.js` and `public/index.html`.

The game is designed to work on desktop and mobile devices in the same local network.

## Features

- Large arena map.
- Multiple difficulty levels in the single-player version.
- AI enemies with different behavior profiles.
- Deadly obstacles on the map.
- Health that slowly drains over time.
- Boost as a limited resource with no automatic regeneration.
- Health and boost restoration through eating food.
- Collisions with snakes, bodies, tails, obstacles, and arena borders.
- Mini-map.
- Leaderboard.
- Desktop and mobile controls.
- Local storage for player name, record, and selected difficulty in single-player mode.
- LAN multiplayer for two or more players in the same network.

## Project Structure

```text
snake_arena/
├── index.html          # Standalone single-player version
├── server.js           # LAN multiplayer server, no external dependencies
├── public/
│   └── index.html      # LAN multiplayer browser client
├── README.md
└── .gitignore
```

## Requirements

Single-player mode only needs a browser.

LAN multiplayer mode requires Node.js.

No npm packages are required. The multiplayer server uses only built-in Node.js modules.

## Run Single-Player Mode

Open `index.html` directly in a browser.

Optional local static server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Run LAN Multiplayer Mode

Start the server on one computer in the local network:

```bash
node server.js
```

The server prints addresses like:

```text
Snake Arena LAN server: http://localhost:3000
LAN: http://192.168.1.25:3000
```

The host can open:

```text
http://localhost:3000
```

Other players on the same Wi-Fi or local network should open the LAN address, for example:

```text
http://192.168.1.25:3000
```

Each player enters a name and joins the arena from their own device.

## Multiplayer Architecture

The LAN mode uses an authoritative Node.js server:

- the server owns the world state;
- players send input to the server;
- the server updates snakes, food, obstacles, AI bots, resources, and collisions;
- clients poll the current arena snapshot and render it locally;
- no external backend or internet connection is required after the local server is running.

This design is intentionally simple and robust for local network play.

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

## Single-Player Difficulty Levels

| Difficulty | Description |
|---|---|
| Easy | Fewer enemies and obstacles, lower resource pressure |
| Normal | Balanced baseline mode |
| Hard | More enemies, higher aggression, denser arena |
| Expert | More obstacles, faster enemy reaction, stronger interception behavior |

## Enemy Behavior

AI enemies evaluate:

- distance to food;
- threats from other snakes;
- own health;
- boost reserve;
- obstacles;
- arena borders;
- chase opportunities;
- interception opportunities;
- collision risk with snake bodies.

Enemy behavior profiles include:

- forager;
- coward;
- hunter;
- duelist;
- trapper.

## Current Status

The project is ready for manual testing in both modes:

- single-player directly from `index.html`;
- LAN multiplayer through `node server.js`.

## Recommended Next Steps

1. Split the single-player code into `src/`, `styles/`, and `assets/`.
2. Add automated JavaScript validation.
3. Add a proper WebSocket transport for lower-latency multiplayer.
4. Add server-side rooms and match settings.
5. Add GitHub Pages for the single-player build.
6. Add a settings menu for graphics and control sensitivity.
