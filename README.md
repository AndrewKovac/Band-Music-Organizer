# Band Music Organizer — March Prep

A single-file, browser-based tool for turning a pile of band score PDFs into clean, per-player **part books** ready to print and three-hole punch. Everything runs locally in your browser — no upload, no server required. Open [`march-prep.html`](march-prep.html) and go.

## What it does

Four steps, top to bottom:

1. **Setup** — define your instrument list (canonical names + label aliases used for tagging shortcuts and OCR guesses) and page/binding options: gutter, margins, binding edge, single- vs double-sided printing, and trim.
2. **Songs** — drop in one PDF per song. On import the app detects pages that hold **two stacked parts** and splits them automatically. Each resulting part is framed as **Lyre** (half page, two share a sheet) or **Full page**.
3. **Tag** — assign each part to a player. Parts are auto-cropped to the music, auto-straightened, and fit into their frame so nothing is clipped. Keyboard-first: `/` to search (e.g. `as2` → Alto Sax 2), `Enter` to assign, `C` continuation, `X` ignore, `U` next-untagged, `S` re-straighten, `←/→` to move. Tick a checkbox to put one part in two books (e.g. a lone alto sax into both Alto 1 and 2). Manual rotate/scale/skew with an alignment grid, plus a 1↔2 part split override.
4. **Build** — one Letter-size PDF per player: full-page parts first, then Lyre parts paired two-up, all trimmed, scaled and punch-margined (gutter alternates each page for double-sided so the holes line up). Preview each book — see the punch holes and margins, drag parts to reposition, scroll/handle to scale, delete duplicates — then generate and download individually or as a zip.

## Running locally

Just open `march-prep.html` in a modern browser. It loads its libraries (pdf.js, pdf-lib, tesseract.js, jszip) from a CDN, so an internet connection is needed the first time.

If your browser blocks features on `file://`, serve the folder instead:

```bash
node serve.js
# then open http://localhost:8000
```

## Notes

- All processing is client-side; your PDFs never leave your machine.
- OCR (auto-guessing the instrument from the corner label) is optional — manual tagging is fast without it.
- Sheet-music PDFs are intentionally git-ignored.

🤖 Built with [Claude Code](https://claude.com/claude-code)
