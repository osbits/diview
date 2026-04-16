# diview

A maximally lightweight, cross-platform DICOM viewer.

- **2D (X-ray / CR / DX / MG)**: window/level, pan, zoom, length, angle, invert.
- **CT / MR volumes**: three orthogonal MPR viewports (axial / sagittal / coronal) with synchronized crosshairs.
- **Zero server**: all parsing and rendering happen locally in the browser.
- Ships as a single self-contained `dist/index.html` file — open from `file://`, email it, or drop it on any static host.

Built on [Cornerstone3D](https://www.cornerstonejs.org/) + [dicom-parser](https://github.com/cornerstonejs/dicomParser).

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Drag DICOM files or a folder onto the window. A multi-slice CT / MR series is auto-detected as a volume and opens in the MPR layout; single-image studies open in the 2D viewer. Use the left sidebar to switch series.

## Build the single-file viewer

```bash
npm run build
# -> dist/index.html  (one file, ~2.8 MB, all JS + CSS inlined)
```

You can now:

- Open `dist/index.html` directly in a browser (`file://…`)
- Serve it from any static host: `npx http-server dist/`
- Email it or drop it on a USB stick — nothing else required

## Controls

| Action                        | Mouse / keyboard                    |
| ----------------------------- | ----------------------------------- |
| MPR crosshair / reslice       | Left-drag (default on MPR)          |
| Window / Level                | Toolbar → W/L, then left-drag       |
| Measure length / angle        | Toolbar → Length / Angle            |
| Pan                           | Middle-drag                         |
| Zoom                          | Right-drag                          |
| Scroll slices                 | Mouse wheel, or ↑ / ↓ / PgUp / PgDn |
| Invert grayscale              | Toolbar → Invert                    |
| Reset view & W/L              | Toolbar → Reset                     |

## Project layout

```
index.html                 entry
src/
  main.ts                  bootstrap (Cornerstone3D init, tool groups)
  loader.ts                file intake, series grouping, 2D vs volume
  viewer2d.ts              StackViewport
  viewerMpr.ts             3× OrthographicViewport + crosshairs
  ui.ts                    toolbar, series list, drag-and-drop
  styles.css
  stubs/                   empty shims for unused segmentation/wasm paths
vite.config.ts             single-file build, alias stubs
```

## Scope

v1 intentionally omits volume rendering, segmentation, DICOMweb / PACS networking, and measurement export. The Cornerstone3D foundation supports all of these and can be layered on later.
