import type { JSONContent } from "@tiptap/core";
import { sampleNoteHtml } from "../editor/sampleNote.ts";

const NOTES_STORAGE_KEY = "void-note.notes.v1";
const NOTE_SCHEMA_VERSION = 1;
const DEFAULT_NOTE_TITLE = "Untitled note";

const encoder = new TextEncoder();

type ChromeStorageArea = {
  get: (
    keys: string | string[] | Record<string, unknown> | null,
    callback: (items: Record<string, unknown>) => void,
  ) => void;
  set: (items: Record<string, unknown>, callback?: () => void) => void;
};

type ChromeRuntime = {
  lastError?: {
    message?: string;
  };
};

type ChromeLike = {
  runtime?: ChromeRuntime;
  storage?: {
    local?: ChromeStorageArea;
  };
};

export type NoteTabGroup = {
  groupId: number;
  windowId?: number;
  title?: string;
  color?: string;
};

export type StoredNote = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  summary: string | null;
  summaryUpdatedAt: string | null;
  sizeBytes: number;
  contentHtml: string;
  contentJson: JSONContent | null;
  plainText: string;
  tabGroup: NoteTabGroup | null;
};

export type NotesStoreSnapshot = {
  schemaVersion: typeof NOTE_SCHEMA_VERSION;
  activeNoteId: string;
  notes: StoredNote[];
};

export type NoteContentSnapshot = {
  html: string;
  json: JSONContent;
  plainText: string;
};

function createNoteId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();

  if (typeof randomUuid === "string" && randomUuid.length > 0) {
    return randomUuid;
  }

  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createStarterDocumentJson(title = DEFAULT_NOTE_TITLE): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: {
          level: 1,
        },
        content: [{ type: "text", text: title }],
      },
      {
        type: "paragraph",
      },
    ],
  };
}

function chromeStorageArea(): ChromeStorageArea | null {
  const chromeApi = (globalThis as { chrome?: ChromeLike }).chrome;
  return chromeApi?.storage?.local ?? null;
}

async function readChromeStorageValue<T>(key: string): Promise<T | null> {
  const area = chromeStorageArea();

  if (!area) {
    return null;
  }

  return await new Promise<T | null>((resolve) => {
    area.get(key, (items) => {
      const chromeApi = (globalThis as { chrome?: ChromeLike }).chrome;
      const runtimeError = chromeApi?.runtime?.lastError;

      if (runtimeError) {
        resolve(null);
        return;
      }

      const value = items[key];
      resolve((value as T | undefined) ?? null);
    });
  });
}

async function writeChromeStorageValue<T>(
  key: string,
  value: T,
): Promise<boolean> {
  const area = chromeStorageArea();

  if (!area) {
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    area.set({ [key]: value }, () => {
      const chromeApi = (globalThis as { chrome?: ChromeLike }).chrome;
      const runtimeError = chromeApi?.runtime?.lastError;
      resolve(!runtimeError);
    });
  });
}

function coerceNote(raw: unknown): StoredNote | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Partial<StoredNote>;

  if (typeof value.id !== "string") {
    return null;
  }

  const createdAt = typeof value.createdAt === "string"
    ? value.createdAt
    : new Date().toISOString();

  const updatedAt = typeof value.updatedAt === "string"
    ? value.updatedAt
    : createdAt;
  const summary =
    typeof value.summary === "string" && value.summary.trim().length > 0
      ? value.summary
      : null;
  const summaryUpdatedAt = typeof value.summaryUpdatedAt === "string"
    ? value.summaryUpdatedAt
    : null;

  const contentHtml = typeof value.contentHtml === "string"
    ? value.contentHtml
    : "";

  const contentJson = value.contentJson && typeof value.contentJson === "object"
    ? value.contentJson
    : null;

  const plainText = typeof value.plainText === "string" ? value.plainText : "";

  const title = resolveNoteTitle(contentJson, contentHtml);

  const sizeBytes = typeof value.sizeBytes === "number"
    ? value.sizeBytes
    : estimateNoteSizeBytes(contentJson, contentHtml, plainText);

  const tabGroup = value.tabGroup && typeof value.tabGroup === "object"
    ? value.tabGroup
    : null;

  return {
    id: value.id,
    createdAt,
    updatedAt,
    title,
    summary,
    summaryUpdatedAt,
    sizeBytes,
    contentHtml,
    contentJson,
    plainText,
    tabGroup,
  };
}

function normalizeSnapshot(raw: unknown): NotesStoreSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Partial<NotesStoreSnapshot>;

  if (
    value.schemaVersion !== NOTE_SCHEMA_VERSION || !Array.isArray(value.notes)
  ) {
    return null;
  }

  const notes = value.notes.map(coerceNote).filter((note): note is StoredNote =>
    note !== null
  );

  if (notes.length === 0) {
    return null;
  }

  const activeNoteId = typeof value.activeNoteId === "string"
    ? value.activeNoteId
    : notes[0].id;

  const activeNoteExists = notes.some((note) => note.id === activeNoteId);

  return {
    schemaVersion: NOTE_SCHEMA_VERSION,
    activeNoteId: activeNoteExists ? activeNoteId : notes[0].id,
    notes,
  };
}

function localStorageAvailable(): boolean {
  try {
    return typeof globalThis.localStorage !== "undefined";
  } catch {
    return false;
  }
}

function readLocalStorageValue<T>(key: string): T | null {
  if (!localStorageAvailable()) {
    return null;
  }

  try {
    const raw = globalThis.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocalStorageValue<T>(key: string, value: T): boolean {
  if (!localStorageAvailable()) {
    return false;
  }

  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function resolveNoteTitle(
  contentJson: JSONContent | null,
  contentHtml: string,
): string {
  const headingFromJson = findFirstHeadingText(contentJson);

  if (headingFromJson.length > 0) {
    return headingFromJson;
  }

  const headingFromHtml = findHeadingFromHtml(contentHtml);
  if (headingFromHtml.length > 0) {
    return headingFromHtml;
  }

  return DEFAULT_NOTE_TITLE;
}

function findHeadingFromHtml(contentHtml: string): string {
  if (contentHtml.trim().length === 0 || typeof DOMParser === "undefined") {
    return "";
  }

  try {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(contentHtml, "text/html");
    const headingElement = documentNode.querySelector("h1");
    return headingElement?.textContent?.trim() ?? "";
  } catch {
    return "";
  }
}

function findFirstHeadingText(contentJson: JSONContent | null): string {
  if (!contentJson) {
    return "";
  }

  const walk = (node: JSONContent): string => {
    if (node.type === "heading" && node.attrs?.level === 1) {
      return extractText(node).trim();
    }

    if (!Array.isArray(node.content)) {
      return "";
    }

    for (const child of node.content) {
      const result = walk(child);
      if (result.length > 0) {
        return result;
      }
    }

    return "";
  };

  return walk(contentJson);
}

function extractText(node: JSONContent): string {
  const ownText = typeof node.text === "string" ? node.text : "";

  if (!Array.isArray(node.content)) {
    return ownText;
  }

  return ownText + node.content.map(extractText).join("");
}

export function estimateNoteSizeBytes(
  contentJson: JSONContent | null,
  contentHtml: string,
  plainText: string,
): number {
  const payload = JSON.stringify({
    contentJson,
    contentHtml,
    plainText,
  });

  return encoder.encode(payload).byteLength;
}

export function createBlankNote(): StoredNote {
  const now = new Date().toISOString();
  const json = createStarterDocumentJson();
  const html = "<h1>Untitled note</h1><p></p>";

  return {
    id: createNoteId(),
    title: DEFAULT_NOTE_TITLE,
    createdAt: now,
    updatedAt: now,
    summary: null,
    summaryUpdatedAt: null,
    sizeBytes: estimateNoteSizeBytes(json, html, ""),
    contentHtml: html,
    contentJson: json,
    plainText: "",
    tabGroup: null,
  };
}

function createSeedNote(): StoredNote {
  const now = new Date().toISOString();

  return {
    id: createNoteId(),
    title: "Sample note",
    createdAt: now,
    updatedAt: now,
    summary: null,
    summaryUpdatedAt: null,
    sizeBytes: estimateNoteSizeBytes(null, sampleNoteHtml, ""),
    contentHtml: sampleNoteHtml,
    contentJson: null,
    plainText: "",
    tabGroup: null,
  };
}

export function createInitialSnapshot(): NotesStoreSnapshot {
  const seed = createSeedNote();

  return {
    schemaVersion: NOTE_SCHEMA_VERSION,
    activeNoteId: seed.id,
    notes: [seed],
  };
}

export async function loadNotesSnapshot(): Promise<NotesStoreSnapshot> {
  const chromeValue = await readChromeStorageValue<unknown>(NOTES_STORAGE_KEY);
  const chromeSnapshot = normalizeSnapshot(chromeValue);

  if (chromeSnapshot) {
    return chromeSnapshot;
  }

  const localValue = readLocalStorageValue<unknown>(NOTES_STORAGE_KEY);
  const localSnapshot = normalizeSnapshot(localValue);

  if (localSnapshot) {
    return localSnapshot;
  }

  return createInitialSnapshot();
}

export async function persistNotesSnapshot(
  snapshot: NotesStoreSnapshot,
): Promise<void> {
  const normalized = normalizeSnapshot(snapshot);

  if (!normalized) {
    return;
  }

  const wroteChrome = await writeChromeStorageValue(
    NOTES_STORAGE_KEY,
    normalized,
  );

  if (!wroteChrome) {
    writeLocalStorageValue(NOTES_STORAGE_KEY, normalized);
  }
}

function sanitizeFileComponent(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (normalized.length === 0) {
    return "untitled-note";
  }

  return normalized.slice(0, 48);
}

function buildMarkdown(note: StoredNote): string {
  const heading = note.title.trim().length > 0
    ? `# ${note.title.trim()}\n\n`
    : "";
  const body = note.plainText.trim();

  if (body.length === 0) {
    return `${heading}`.trimEnd() + "\n";
  }

  return `${heading}${body}\n`;
}

export async function writeNoteToDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  note: StoredNote,
): Promise<void> {
  type PermissionAwareDirectoryHandle = FileSystemDirectoryHandle & {
    queryPermission?: (
      options?: { mode?: "read" | "readwrite" },
    ) => Promise<PermissionState>;
    requestPermission?: (
      options?: { mode?: "read" | "readwrite" },
    ) => Promise<PermissionState>;
  };

  const handleWithPermissions =
    directoryHandle as PermissionAwareDirectoryHandle;

  if (
    handleWithPermissions.queryPermission &&
    handleWithPermissions.requestPermission
  ) {
    const permissionState = await handleWithPermissions.queryPermission({
      mode: "readwrite",
    });

    if (permissionState !== "granted") {
      const grantedState = await handleWithPermissions.requestPermission({
        mode: "readwrite",
      });
      if (grantedState !== "granted") {
        throw new Error("Folder permission was not granted.");
      }
    }
  }

  const fileStem = `${sanitizeFileComponent(note.title)}-${
    note.id.slice(0, 8)
  }`;
  const jsonName = `${fileStem}.json`;
  const markdownName = `${fileStem}.md`;

  const jsonFileHandle = await directoryHandle.getFileHandle(jsonName, {
    create: true,
  });
  const markdownFileHandle = await directoryHandle.getFileHandle(markdownName, {
    create: true,
  });

  const jsonPayload = JSON.stringify(
    {
      schemaVersion: NOTE_SCHEMA_VERSION,
      note,
    },
    null,
    2,
  );

  const jsonWriter = await jsonFileHandle.createWritable();
  await jsonWriter.write(jsonPayload);
  await jsonWriter.close();

  const markdownWriter = await markdownFileHandle.createWritable();
  await markdownWriter.write(buildMarkdown(note));
  await markdownWriter.close();
}

export function formatEditedTimestamp(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.valueOf())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
