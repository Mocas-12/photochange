<div align="center">

<img src="./logo.svg" width="96" alt="PhotoChange Logo" />

# PhotoChange

**A pure-frontend image workbench — crop · resize · ID photos · watermark · batch convert, all done locally**

[![CI](https://github.com/Mocas-12/photochange/actions/workflows/ci.yml/badge.svg)](https://github.com/Mocas-12/photochange/actions/workflows/ci.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Live-222?logo=githubpages&logoColor=white)](https://mocas-12.github.io/photochange/)
[![HTML5](https://img.shields.io/badge/HTML5-5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/zh-CN/docs/Web/HTML)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript)
[![jsPDF](https://img.shields.io/badge/jsPDF-2.5-007EC6)](https://github.com/parallax/jsPDF)

**[🌐 Live Preview (GitHub Pages)](https://mocas-12.github.io/photochange/)**

**English** | [简体中文](./README.zh-CN.md)

*Open the page → scroll down to the workbench → drop in an image to edit and export*

</div>

---

## 📖 Table of Contents

- [Features](#-features)
- [UI Design](#-ui-design)
- [How It Works](#-how-it-works)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Tests](#-tests)
- [Quota & Activation](#-quota--activation)
- [FAQ](#-faq)
- [Privacy & Security](#-privacy--security)
- [License](#-license)

## ✨ Features

- 🖼️ **Multiple ways to upload**: pick via button or drag & drop; supports PNG / JPG / JPEG / WebP / BMP / AVIF / HEIC; multi-select turns on batch mode
- 🔍 **Canvas viewer**: zoom (20%–400%), ±90° rotation, ruler grid for alignment
- ✂️ **Free crop**: free / 1:1 / 4:3 / 16:9 / 3:2 aspect ratios, with a semi-transparent mask outside the selection for a clear preview
- 📐 **Resize**: width/height inputs with aspect-ratio lock, built-in presets for avatars, 1-inch/2-inch ID photos, official-account covers, Xiaohongshu, HD/FHD and more
- 💧 **Watermark**: text or logo image, single (9-grid position) or tiled diagonal anti-theft mode, opacity & size control
- 🪪 **ID photo tools**: one-click background color replacement (white / blue / red + custom, auto-detected original color, edge feathering) and auto layout on 4×6" paper (300 DPI, print-ready)
- 🎀 **Decoration**: rounded corners and photo borders with custom color
- 📦 **Batch mode**: select multiple files, apply watermark / size / export settings to all, per-file status list
- ↩️ **Undo / Reset**: up to 20 undo steps (Ctrl+Z), one-click reset to the original image
- 💾 **Multi-format export**: PNG / JPG / WebP / BMP / ICO / PDF (auto-fitted and centered on an A4 page)
- 🎯 **Target-size compression**: "compress to N KB" binary-searches the closest quality setting automatically
- 📊 **Live estimate**: the badge at the bottom-right of the canvas shows current format, resolution and export size
- 🔄 **Session restore**: the editing snapshot is auto-saved locally (IndexedDB, valid for 7 days); refresh or accidentally close the page and restore with one click
- 📲 **PWA**: installable to the home screen, app-shell cached by a service worker for offline use
- 🔒 **Privacy**: exports go through canvas re-encoding, so EXIF metadata (including GPS location) is stripped automatically
- 🔑 **Quota system**: 5 free exports, permanently unlocked by an activation code, no account required

## 🎨 UI Design

| Element | Design |
| --- | --- |
| Theme | Deep Space Glow: near-black blue base + three layers of ambient glow |
| Panels | Glassmorphism: semi-transparent background + backdrop blur + thin border |
| Accent | Blue→purple gradient primary buttons + outer glow |
| Page layout | Home / workbench dual full-page switching (wheel · touch · keyboard · arrows) |
| Canvas | Ruler-grid texture + empty-state hint + bottom-right info badge |
| Motion | Staggered hero entrance, title gradient pan, pointer parallax, occasional meteors, breathing dropzone, button shine; respects the system "reduce motion" setting |

## 🧠 How It Works

```mermaid
flowchart LR
    A[🖼️ Upload image<br/>single or batch] --> B[✂️ Canvas editing<br/>crop · resize · watermark · ID photo · decoration]
    B --> C[⚙️ Export parameters<br/>format · quality · target size]
    C --> D[💾 Local encoding & export<br/>PNG · JPG · WebP · BMP · ICO · PDF]
    D --> E[⬇️ Direct browser download]
    B -.auto-snapshot.-> F[🔄 Session restore<br/>IndexedDB · 7 days]
```

1. **Local loading**: the file is decoded via `createObjectURL` + `Image` and drawn onto the working canvas (capped at 4096 px on the long side); HEIC/AVIF go through a self-hosted heic2any first. The original is kept separately for one-click reset
2. **Non-destructive editing**: crop / resize / watermark / adjustments are all done via Canvas, with each step pushed onto the undo stack (up to 20 steps, memory-capped so large photos can't crash the tab)
3. **ID-photo background replacement**: the original background color is auto-detected from the four corners; pixels within the tolerance become the new color with a smoothstep-feathered edge. "Print layout" tiles the photo onto a 4×6" sheet at 300 DPI
4. **Size compression**: once a target size is set, a binary search over the quality parameter (0.05–0.95, up to 9 rounds) picks the highest quality that stays under the target
5. **PDF export**: the canvas is converted to JPEG and embedded into an A4 page via jsPDF, auto-scaled and centered
6. **Session & offline**: edits are snapshot into IndexedDB (watermark/adjust metadata included) and can be restored after a refresh within 7 days; a service worker caches the app shell so the installed PWA works offline
7. **Fully local**: images and export results never leave the browser — no server involved at any point; exports are re-encoded through the canvas, stripping EXIF metadata (including GPS) automatically

## 📁 Project Structure

```text
photochange/
├── index.html          # Single-page structure: workbench + activation modal + custom toasts
├── style.css           # Deep Space Glow theme (glassmorphism + ambient glow)
├── main.js             # Editing core: crop / resize / watermark / export
├── quota.js            # Free-quota counter and activation-code validation
├── page-switch.js      # Home ↔ workbench full-page switching
├── info-badge.js       # Status badge: live resolution & size estimates
├── pointer-fx.js       # Pointer-following effects
├── manifest.webmanifest / service-worker.js  # PWA: installable + offline shell
├── vendor/             # Self-hosted libs (jsPDF, heic2any)
├── tests/              # Playwright smoke suite (npm test)
└── wechatpay/
    └── wechatpay.jpg   # Payment QR code image
```

## 🚀 Quick Start

No dependencies to install — run it locally with any static server:

```bash
git clone https://github.com/Mocas-12/photochange.git
cd photochange
python -m http.server 5173
# Open http://localhost:5173/ in the browser
```

| Command | Description |
| --- | --- |
| `python -m http.server 5173` | Python's built-in static server (recommended) |
| `npx serve .` | Node-based alternative |

> Pushing to the `main` branch automatically updates the live GitHub Pages site — no manual build needed.

## 🧪 Tests

Smoke tests run automatically in CI on every push/PR (Playwright + GitHub Actions). To run them locally:

```bash
npm install
npx playwright install chromium
npm test
```

22 tests cover the crop-coordinate matrix (rotation × mirror), free-quota accounting, target-size export, BMP/ICO encoders, undo, ID-photo background replacement & print layout, decoration, tiled watermark, batch mode, session restore, and the dual-screen page switch.

## 🔑 Quota & Activation

- Free mode: every device gets 5 free exports (counted locally, no registration required)
- Once the quota is used up, clicking export automatically opens the activation modal, which links to Mianbaoduo to get an activation code
- Activation codes use the format `CYxxxS1X`; activation unlocks the device permanently with unlimited exports
- Quota and activation state are stored in the browser's localStorage; clearing browser data resets them

## ❓ FAQ

<details>
<summary><b>How do I make a printable ID-photo sheet?</b></summary>

- Open <b>ID Photo</b>: the original background color is auto-detected — pick white / blue / red (or a custom color) and apply; then click <b>Print Layout</b> to tile the photo onto a 4×6" sheet (300 DPI) ready to print and cut. The built-in 1-inch / 2-inch presets under <b>Resize</b> give the standard photo dimensions first
</details>

<details>
<summary><b>Does background replacement work on complex backgrounds?</b></summary>

- It works on roughly uniform backgrounds (studio-style ID photos, solid backdrops) via color-distance matching. Busy or gradient backgrounds need AI matting, which is not built in yet
</details>

<details>
<summary><b>The browser asks "allow multiple downloads" during batch export</b></summary>

- Allow it. Each image is exported as an individual file named after the original; the batch panel shows per-file status and output size
</details>

<details>
<summary><b>I accidentally refreshed and lost my edits</b></summary>

- Edits are auto-saved locally (IndexedDB). Reopen the page within 7 days and click <b>Restore</b> on the banner to pick up where you left off
</details>

<details>
<summary><b>Why is there no "quality" option for PNG</b></summary>

- PNG uses lossless compression and offers no lossy "quality" parameter; file size depends mainly on image content and resolution
</details>

<details>
<summary><b>I set "compress to N KB" but the exported PNG did not shrink</b></summary>

- PNG cannot be compressed to a target size; the app shows a toast and automatically falls back to JPG compression for export
</details>

<details>
<summary><b>How sharp is the PDF</b></summary>

- It actually embeds the current canvas as a JPEG into the PDF; sharpness depends on the canvas resolution — scale up the dimensions before exporting if needed
</details>

<details>
<summary><b>The exported file is still too large — what now</b></summary>

- Set a "compress to N KB" target size, lower the JPG / WebP quality, or first reduce the resolution under "Resize"
</details>

<details>
<summary><b>Does the quota reset when switching devices or clearing browser data</b></summary>

- Yes. The quota is stored only in this device's localStorage and is not tied to any account
</details>

## 🔒 Privacy & Security

- 🖼️ Images are processed entirely in the browser — **never uploaded, never stored, never routed through any server**
- 🔒 Exports are re-encoded through the canvas, so EXIF metadata (including GPS location) is stripped automatically
- 🔑 No sign-up or login; quota and activation state stay on this device only
- 📊 Visitor analytics record anonymous counts only, with no personally identifiable information collected

## 📄 License

This project is for learning and demonstration purposes and has no open-source license; fork it yourself if you want to reuse it.

---

<div align="center">

**Made with 💙**

🌐 [Live Preview](https://mocas-12.github.io/photochange/) · 🐛 [Report an Issue](https://github.com/Mocas-12/photochange/issues)

</div>
