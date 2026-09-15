# Lane Runner

A browser-based strategic lane-runner roguelite. Plan your route, pick your boosts, execute.

## Development

```
npm install
npm run dev       # http://localhost:3000
```

## Build

```
npm run build     # outputs to dist/
npm run preview   # preview the dist/ build locally
```

## Deploy to itch.io

1. `npm run build`
2. Open `dist/` and select all files inside it (not the folder itself)
3. Zip the selected files — the zip root must contain `index.html`
4. On itch.io: create game → Upload Files → select the zip → kind = "HTML"
5. Set viewport: width **1280**, height **720**
6. Enable "SharedArrayBuffer support" if prompted (not required for this game)
7. Recommended browsers: Chrome, Firefox, Safari (desktop)

## Controls

| Key | Action |
|-----|--------|
| ← → | Switch lane |
| 1 2 3 | Use active boost in that loadout slot |
| R | Retry (plan screen) |
| M | Main menu |
| ESC | Back (from plan screen) |

## Session log export

On the main menu, press **EXPORT LOG** to copy all run data to clipboard as JSON.
The log is stored under `laneRunner.log` in localStorage.

## Tech stack

- Phaser 3 (latest stable)
- Vite 5
- Vanilla JavaScript (ES modules)
- localStorage for save data and session logs
- No external assets — all visuals are Phaser Graphics primitives
