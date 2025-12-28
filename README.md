# True Skate Map Maker 🛹

A visual web-based editor for creating True Skate custom maps.

## Features

- **Drag & Drop Objects**: Ramps, rails, ledges, stairs, and more
- **3D Preview**: Real-time visualization with orbit controls
- **Object Manipulation**: Move, rotate, scale, duplicate, delete
- **Export**: Save your skatepark design (True Skate format coming soon!)

## Quick Start

1. Open `index.html` in a browser (needs local server for ES modules)
2. Click objects in the left panel to place them
3. Click placed objects to select and edit
4. Use mouse to orbit/pan/zoom the view
5. Export when ready!

## Controls

| Action | Control |
|--------|---------|
| Rotate View | Left Mouse Drag |
| Pan View | Right Mouse Drag |
| Zoom | Scroll Wheel |
| Place Object | Click (in place mode) |
| Select Object | Click on object |
| Rotate Object | R key |
| Delete Object | Delete key |
| Cancel | Escape |

## Running Locally

```bash
# Python 3
python -m http.server 8080

# Then open http://localhost:8080
```

## Roadmap

- [ ] Full True Skate format export
- [ ] More skate objects
- [ ] Textures and materials
- [ ] Import existing maps
- [ ] Undo/Redo

---

Made with ❤️ for the True Skate modding community
