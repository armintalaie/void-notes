# Void Note Chrome Side Panel

This folder contains the Manifest V3 side panel extension for Void Note,
wrapping the existing React/Vite rich-text editor.

## Build the side panel bundle

From the project root:

```bash
deno task build:extension
```

This outputs extension page assets into `chrome-extension/dist`.

## Load in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select the `chrome-extension` folder

Click the extension action button to open the side panel.

## Notes behavior

The side panel renders the same editor app and starts with sample note content.
No extension storage is wired yet.
