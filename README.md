# Void Note

Void Note is a local-first notes app built with React + Tiptap, with two ways to run:

- Standalone web app (Vite)
- Chrome side panel extension (Manifest V3)

The app focuses on rich structured notes, capture workflows, and customization-heavy editor UX.

## What It Does

- Creates and manages multiple notes with Home + Editor views
- Autosaves notes locally (Chrome storage when available, localStorage fallback)
- Provides a rich-text editor with custom blocks and slash commands
- Exports notes as HTML, Markdown, plain text, and JSON
- Optionally syncs the active note to a local folder as `.json` + `.md`
- Supports AI note summaries via Chrome's built-in Summarizer API
- In extension mode, captures page/selection/link content into notes from context menus

## Main Features

### Note management

- Create, open, duplicate, delete, and search notes
- Note picker and Home list with previews, size, and edited timestamps
- Autosave after idle, plus flush on tab hide/unload

### Rich editor (Tiptap)

- Formatting: headings, bold, italic, underline, strikethrough, links
- Lists: bullet list + status checklist (`todo`, `in_progress`, `done`, `archived`)
- Tables (resizable)
- Callout block
- Quote block with editable source/context footer
- Due date block with date/time picker
- Tabs block (multi-panel content with rename/insert/delete tab actions)
- Nested page block (opens embedded page in sheet/drawer)
- Code block with language selector + copy button
- Variable field tokens with variable management drawer and highlighting modes
- Slash-command menu with keyboard navigation

### Editor customization

- Theme controls for mode, background range, color palette, accent color
- Alert tone/strength controls (success/info/warning/danger)
- Font, font scale, radius, and elevation controls
- Node-level feature toggles and style controls (table/callout/code block)
- Settings persisted to local storage

### Sharing/export

- Download or copy:
  - HTML (full styled document)
  - Text
  - Markdown
  - JSON (content + variables + node settings + appearance metadata)

### Chrome extension capture flow

- Side panel app uses the same editor UI
- Context menu: `Append to Void Note`
- Append to:
  - New note
  - Existing note (up to 20 recent notes shown)
- Captured quote stores source context (URL/tab/window metadata)
- Source links in notes can reopen/focus the original tab when possible

## Main Libraries / Tech Stack

- React 19
- TypeScript
- Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Tiptap v3:
  - `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/core`, `@tiptap/pm`
  - `@tiptap/extension-link`
  - `@tiptap/extension-underline`
  - `@tiptap/extension-task-list`
  - `@tiptap/extension-task-item` (extended in-app)
  - `@tiptap/extension-table`, `table-row`, `table-header`, `table-cell`
  - `@tiptap/extension-code-block-lowlight`
  - `@tiptap/extension-placeholder`
- Syntax highlighting:
  - `lowlight`
  - `highlight.js`
- UI primitives:
  - `@base-ui/react` (`Menu`, `Dialog`, `Drawer`, `Switch`)
- Icons:
  - `react-icons` (Tabler icons)
- Build analysis:
  - `rollup-plugin-visualizer` (extension build)
- Runtime/tooling:
  - Deno tasks
  - ESLint + TypeScript

## Requirements

- Deno `2.7+` (project tasks are Deno-first)
- Chrome `114+` for the extension side panel
- Chrome `138+` with built-in AI enabled for note summarization
- Optional: Node/npm scripts exist in `package.json`, but Deno tasks are the intended workflow

## Installation & Setup (Standalone App)

```bash
git clone <your-repo-url>
cd void-notes
deno install
deno task dev
```

Then open the local Vite URL shown in terminal (usually `http://localhost:5173`).

### Standalone build commands

```bash
deno task check
deno task lint
deno task build
deno task preview
```

## Chrome Extension Setup

### 1) Build extension assets

From project root:

```bash
deno task build:extension
```

This outputs side panel assets under `chrome-extension/dist`.

### 2) Load unpacked extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `chrome-extension` folder

Click the extension action button to open the side panel.

### 3) Extension dev mode (watch build)

```bash
deno task dev:extension
```

After each rebuild, reload the extension in `chrome://extensions`.

## Data & Storage Behavior

- Notes storage key: `void-note.notes.v1`
- Appearance storage key: `void-note.appearance.v1`
- Storage priority:
  1. `chrome.storage.local` (when Chrome extension APIs are available)
  2. `localStorage` fallback
- Disk sync:
  - Uses File System Access API directory picker
  - Writes active note to selected folder as:
    - `<slug>-<id>.json`
    - `<slug>-<id>.md`

## Project Structure

```text
src/
  App.tsx                     # App shell, notes list/home/editor, autosave, summary, disk sync
  editor/                     # Tiptap editor + custom nodes/extensions
  notes/noteStore.ts          # Storage and snapshot persistence utilities
  extension/main.tsx          # Side panel entry
chrome-extension/
  manifest.json               # MV3 manifest
  service-worker.js           # Background logic: context menus + source tab opening
  sidepanel.html              # Extension side panel page
vite.extension.config.ts      # Extension build config
deno.json                     # Deno task definitions
```

## Available Deno Tasks

- `deno task dev`
- `deno task build`
- `deno task build:extension`
- `deno task dev:extension`
- `deno task preview`
- `deno task lint`
- `deno task fmt`
- `deno task fmt:check`
- `deno task check`
- `deno task test`

## Notes / Limitations

- No backend or cloud sync is wired yet
- Summary feature depends on Chrome built-in Summarizer API availability
- Runtime font loading fetches web font CSS at runtime
- Build currently emits large JS chunk warnings (expected with current bundle size)
