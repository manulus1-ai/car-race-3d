# Car Race 3D (Three.js)

A lightweight, static Three.js car racing mini-game designed for GitHub Pages.

## Play
After GitHub Pages is enabled, the live game will be available at:

- `https://manulus1-ai.github.io/car-race-3d/`

## Controls
- Desktop: **WASD** / **Arrow keys**
- Reset: **R**
- Toggle sound: **M**
- Mobile: on-screen touch buttons

## Dev
This is a static site served from `/docs`.

To run locally:

```bash
cd docs
python3 -m http.server 8000
# then open http://localhost:8000
```

## Notes
- Track is a rounded rectangle spline with a ribbon mesh.
- Simple arcade handling (no physics engine).
- Lap counting uses a start-line + checkpoint gate.
