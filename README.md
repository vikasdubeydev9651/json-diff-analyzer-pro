# JSON Diff Analyzer Pro

A client-side Angular 15 application for comparing two JSON files with both structural JSON analysis and exact line-level text diff.

## Features
- Upload two JSON or text files, or paste content directly.
- Validate and format JSON.
- Recursive JSON comparison with JSON paths (`$.buildingDetails.floors`, `$.items[0].name`).
- Added, removed and modified property detection, including type changes.
- Human-readable deterministic explanations for each JSON data change.
- Numeric delta and percentage explanations.
- Exact line-by-line comparison with added/removed/modified highlighting.
- Search, unchanged-row toggle, next/previous change controls.
- Export a machine-readable JSON comparison report.
- All processing happens in the browser; no API or backend is used.

## Requirements
- Node.js 18.13+ (Node 20 LTS recommended)
- npm 8+

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:4200`.

## Production build

```bash
npm run build
```

Build output: `dist/json-diff-analyzer-pro/`.

## How the comparison works

1. **JSON-aware comparison:** parses both inputs and recursively compares object properties and array positions. Object key order and whitespace do not create JSON data changes.
2. **Line comparison:** compares the original text line-by-line using an LCS-based diff algorithm. It pairs adjacent remove/add rows as modified lines. A bounded greedy fallback is used for very large inputs to avoid allocating an oversized LCS matrix.
3. **Explanations:** generated locally from the old/new values and JSON path. No generative AI is involved.

## Important behavior / limitations
- Array items are compared by index. Reordering an array can therefore appear as several modifications; this version does not infer semantic identity for array objects.
- Line-level modified rows are inferred by pairing adjacent removed and added lines; the JSON-aware path view is the authoritative semantic comparison for valid JSON.
- The current upload picker accepts JSON and text files, but JSON-aware analysis requires valid JSON in both inputs.
- For large documents, exact line diff switches to a memory-bounded greedy fallback. The UI remains local, but very large files can still be limited by browser memory.
