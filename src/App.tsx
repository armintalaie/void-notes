import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TbChevronDown, TbFilePlus, TbFolder } from "react-icons/tb";
import { NoteEditor, type NoteEditorSnapshot } from "./editor/NoteEditor.tsx";
import { ensureRuntimeFonts } from "./fonts/runtimeFonts.ts";
import {
  createBlankNote,
  estimateNoteSizeBytes,
  formatEditedTimestamp,
  loadNotesSnapshot,
  type NotesStoreSnapshot,
  persistNotesSnapshot,
  resolveNoteTitle,
  type StoredNote,
  writeNoteToDirectory,
} from "./notes/noteStore.ts";
import type {
  AccentColor,
  AlertStrength,
  AlertTone,
  AppearanceSettings,
  BgPalette,
  BodyFont,
  ElevationPack,
  FontScale,
  HeadingFont,
  Mode,
  Palette,
  RadiusPack,
} from "./themeControls.ts";
import { defaultAppearanceSettings } from "./themeControls.ts";

const AUTOSAVE_IDLE_MS = 2200;
const NOTES_STORAGE_KEY = "void-note.notes.v1";
const SOURCE_LINK_PREFIX = "voidnote-source://open?";
const NOTE_PREVIEW_EMPTY = "No content yet.";
const APPEARANCE_STORAGE_KEY = "void-note.appearance.v1";
const SUMMARY_MAX_INPUT_CHARS = 12000;

type AppPanel = "home" | "editor";
type SummaryStatus =
  | "idle"
  | "checking"
  | "downloading"
  | "generating"
  | "error";

type SummarizerAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

type SummarizerDownloadProgressEvent = {
  loaded: number;
};

type SummarizerMonitor = {
  addEventListener: (
    type: "downloadprogress",
    listener: (event: SummarizerDownloadProgressEvent) => void,
  ) => void;
};

type SummarizerSession = {
  summarize: (input: string, options?: { context?: string }) => Promise<string>;
  destroy?: () => void;
};

type SummarizerApi = {
  availability: () => Promise<SummarizerAvailability | string>;
  create: (options?: {
    sharedContext?: string;
    type?: "key-points" | "tldr" | "teaser" | "headline";
    format?: "markdown" | "plain-text";
    length?: "short" | "medium" | "long";
    preference?: "auto" | "speed" | "capability";
    monitor?: (monitor: SummarizerMonitor) => void;
  }) => Promise<SummarizerSession>;
};

type WindowWithDirectoryPicker = Window & typeof globalThis & {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<FileSystemDirectoryHandle>;
};

function parseSourceHref(
  href: string,
): { url: string; tabId: number | null; windowId: number | null } | null {
  if (!href.startsWith(SOURCE_LINK_PREFIX)) {
    return null;
  }

  const query = href.slice(SOURCE_LINK_PREFIX.length);
  const params = new URLSearchParams(query);
  const url = params.get("url") ?? "";

  if (url.length === 0) {
    return null;
  }

  const tabIdRaw = params.get("tabId");
  const windowIdRaw = params.get("windowId");

  return {
    url,
    tabId: tabIdRaw && /^\d+$/.test(tabIdRaw) ? Number(tabIdRaw) : null,
    windowId: windowIdRaw && /^\d+$/.test(windowIdRaw)
      ? Number(windowIdRaw)
      : null,
  };
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createNotePreview(title: string, plainText: string): string {
  const normalizedTitle = title.trim().toLowerCase();
  const lines = plainText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return NOTE_PREVIEW_EMPTY;
  }

  const previewLines =
    normalizedTitle.length > 0 && lines[0].toLowerCase() === normalizedTitle
      ? lines.slice(1)
      : lines;
  const preview = previewLines.join(" ").trim();

  return preview.length > 0 ? preview : NOTE_PREVIEW_EMPTY;
}

function noteMatchesQuery(
  note: { title: string; plainText: string },
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  const haystack = `${note.title}\n${note.plainText}`.toLowerCase();
  return haystack.includes(normalizedQuery);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderSummaryMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const blocks: string[] = [];
  let currentListItems: string[] = [];
  let currentParagraphLines: string[] = [];

  const flushList = () => {
    if (currentListItems.length === 0) {
      return;
    }

    blocks.push(`<ul>${currentListItems.join("")}</ul>`);
    currentListItems = [];
  };

  const flushParagraph = () => {
    if (currentParagraphLines.length === 0) {
      return;
    }

    const paragraph = currentParagraphLines.join(" ").trim();
    if (paragraph.length > 0) {
      blocks.push(`<p>${escapeHtml(paragraph)}</p>`);
    }
    currentParagraphLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      flushList();
      flushParagraph();
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/) ??
      line.match(/^\d+\.\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      currentListItems.push(`<li>${escapeHtml(bulletMatch[1].trim())}</li>`);
      continue;
    }

    flushList();
    currentParagraphLines.push(line);
  }

  flushList();
  flushParagraph();

  if (blocks.length === 0) {
    return `<p>${escapeHtml(markdown.trim())}</p>`;
  }

  return blocks.join("");
}

function summarySourceText(note: StoredNote): string {
  const text = note.plainText.trim();

  if (text.length <= SUMMARY_MAX_INPUT_CHARS) {
    return text;
  }

  return text.slice(0, SUMMARY_MAX_INPUT_CHARS);
}

function pickAppearanceValue<T extends string>(value: unknown, fallback: T): T {
  return typeof value === "string" ? value as T : fallback;
}

function loadPersistedAppearanceSettings(): AppearanceSettings {
  if (typeof globalThis.localStorage === "undefined") {
    return defaultAppearanceSettings;
  }

  try {
    const raw = globalThis.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) {
      return defaultAppearanceSettings;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return defaultAppearanceSettings;
    }

    const value = parsed as Partial<Record<keyof AppearanceSettings, unknown>>;

    return {
      mode: pickAppearanceValue(value.mode, defaultAppearanceSettings.mode),
      bgPalette: pickAppearanceValue(
        value.bgPalette,
        defaultAppearanceSettings.bgPalette,
      ),
      palette: pickAppearanceValue(
        value.palette,
        defaultAppearanceSettings.palette,
      ),
      accentColor: pickAppearanceValue(
        value.accentColor,
        defaultAppearanceSettings.accentColor,
      ),
      alertSuccessTone: pickAppearanceValue(
        value.alertSuccessTone,
        defaultAppearanceSettings.alertSuccessTone,
      ),
      alertSuccessStrength: pickAppearanceValue(
        value.alertSuccessStrength,
        defaultAppearanceSettings.alertSuccessStrength,
      ),
      alertInfoTone: pickAppearanceValue(
        value.alertInfoTone,
        defaultAppearanceSettings.alertInfoTone,
      ),
      alertInfoStrength: pickAppearanceValue(
        value.alertInfoStrength,
        defaultAppearanceSettings.alertInfoStrength,
      ),
      alertWarningTone: pickAppearanceValue(
        value.alertWarningTone,
        defaultAppearanceSettings.alertWarningTone,
      ),
      alertWarningStrength: pickAppearanceValue(
        value.alertWarningStrength,
        defaultAppearanceSettings.alertWarningStrength,
      ),
      alertDangerTone: pickAppearanceValue(
        value.alertDangerTone,
        defaultAppearanceSettings.alertDangerTone,
      ),
      bodyFont: pickAppearanceValue(
        value.bodyFont,
        defaultAppearanceSettings.bodyFont,
      ),
      headingFont: pickAppearanceValue(
        value.headingFont,
        defaultAppearanceSettings.headingFont,
      ),
      fontScale: pickAppearanceValue(
        value.fontScale,
        defaultAppearanceSettings.fontScale,
      ),
      radius: pickAppearanceValue(
        value.radius,
        defaultAppearanceSettings.radius,
      ),
      elevation: pickAppearanceValue(
        value.elevation,
        defaultAppearanceSettings.elevation,
      ),
    };
  } catch {
    return defaultAppearanceSettings;
  }
}

function persistAppearanceSettings(settings: AppearanceSettings): void {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  try {
    globalThis.localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify(settings),
    );
  } catch {
    // Ignore storage write failures.
  }
}

function App() {
  const initialAppearance = useMemo(
    () => loadPersistedAppearanceSettings(),
    [],
  );
  const [mode, setMode] = useState<Mode>(initialAppearance.mode);
  const [bgPalette, setBgPalette] = useState<BgPalette>(
    initialAppearance.bgPalette,
  );
  const [palette, setPalette] = useState<Palette>(initialAppearance.palette);
  const [accentColor, setAccentColor] = useState<AccentColor>(
    initialAppearance.accentColor,
  );
  const [alertSuccessTone, setAlertSuccessTone] = useState<AlertTone>(
    initialAppearance.alertSuccessTone,
  );
  const [alertSuccessStrength, setAlertSuccessStrength] = useState<
    AlertStrength
  >(
    initialAppearance.alertSuccessStrength,
  );
  const [alertInfoTone, setAlertInfoTone] = useState<AlertTone>(
    initialAppearance.alertInfoTone,
  );
  const [alertInfoStrength, setAlertInfoStrength] = useState<AlertStrength>(
    initialAppearance.alertInfoStrength,
  );
  const [alertWarningTone, setAlertWarningTone] = useState<AlertTone>(
    initialAppearance.alertWarningTone,
  );
  const [alertWarningStrength, setAlertWarningStrength] = useState<
    AlertStrength
  >(
    initialAppearance.alertWarningStrength,
  );
  const [alertDangerTone, setAlertDangerTone] = useState<AlertTone>(
    initialAppearance.alertDangerTone,
  );
  const [bodyFont, setBodyFont] = useState<BodyFont>(
    initialAppearance.bodyFont,
  );
  const [headingFont, setHeadingFont] = useState<HeadingFont>(
    initialAppearance.headingFont,
  );
  const [fontScale, setFontScale] = useState<FontScale>(
    initialAppearance.fontScale,
  );
  const [radius, setRadius] = useState<RadiusPack>(initialAppearance.radius);
  const [elevation, setElevation] = useState<ElevationPack>(
    initialAppearance.elevation,
  );
  const [useSampleNote, setUseSampleNote] = useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [notesSnapshot, setNotesSnapshot] = useState<NotesStoreSnapshot | null>(
    null,
  );
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [activePanel, setActivePanel] = useState<AppPanel>("home");
  const [hasPendingAutosave, setHasPendingAutosave] = useState(false);
  const [lastPersistedAt, setLastPersistedAt] = useState<string | null>(null);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [notePickerQuery, setNotePickerQuery] = useState("");
  const [homeSearchQuery, setHomeSearchQuery] = useState("");
  const [directoryHandle, setDirectoryHandle] = useState<
    FileSystemDirectoryHandle | null
  >(null);
  const [diskSyncMessage, setDiskSyncMessage] = useState(
    "Disk sync not connected",
  );
  const [externalContentRevision, setExternalContentRevision] = useState(0);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>("idle");
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryDownloadProgress, setSummaryDownloadProgress] = useState<
    number | null
  >(null);
  const [summaryWorkingNoteId, setSummaryWorkingNoteId] = useState<
    string | null
  >(null);

  const notePickerRef = useRef<HTMLDivElement>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const latestSnapshotRef = useRef<NotesStoreSnapshot | null>(null);
  const summarizerRef = useRef<SummarizerSession | null>(null);

  useEffect(() => {
    latestSnapshotRef.current = notesSnapshot;
  }, [notesSnapshot]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const loadedSnapshot = await loadNotesSnapshot();

      if (cancelled) {
        return;
      }

      setNotesSnapshot(loadedSnapshot);
      setNotesLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    type ChromeStorageOnChanged = {
      addListener?: (
        callback: (
          changes: Record<string, { newValue?: unknown }>,
          areaName: string,
        ) => void,
      ) => void;
      removeListener?: (
        callback: (
          changes: Record<string, { newValue?: unknown }>,
          areaName: string,
        ) => void,
      ) => void;
    };

    const chromeApi = (globalThis as {
      chrome?: {
        storage?: {
          onChanged?: ChromeStorageOnChanged;
        };
      };
    }).chrome;

    const listener = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ) => {
      if (areaName !== "local") {
        return;
      }

      if (!changes[NOTES_STORAGE_KEY]) {
        return;
      }

      void (async () => {
        const refreshedSnapshot = await loadNotesSnapshot();
        const previousSnapshot = latestSnapshotRef.current;

        const previousActive = previousSnapshot?.notes.find((note) =>
          note.id === previousSnapshot.activeNoteId
        ) ?? null;
        const nextActive = refreshedSnapshot.notes.find((note) =>
          note.id === refreshedSnapshot.activeNoteId
        ) ?? null;

        const shouldRefreshOpenEditor = Boolean(
          previousActive &&
            nextActive &&
            previousActive.id === nextActive.id &&
            previousActive.updatedAt !== nextActive.updatedAt,
        );

        setNotesSnapshot(refreshedSnapshot);
        setNotesLoaded(true);

        if (shouldRefreshOpenEditor) {
          setExternalContentRevision((value) =>
            value + 1
          );
        }
      })();
    };

    chromeApi?.storage?.onChanged?.addListener?.(listener);

    return () => {
      chromeApi?.storage?.onChanged?.removeListener?.(listener);
    };
  }, []);

  const activeNote = useMemo(() => {
    if (!notesSnapshot || notesSnapshot.notes.length === 0) {
      return null;
    }

    const matchingNote = notesSnapshot.notes.find((note) =>
      note.id === notesSnapshot.activeNoteId
    );
    return matchingNote ?? notesSnapshot.notes[0];
  }, [notesSnapshot]);

  useEffect(() => {
    if (!notesSnapshot || !activeNote) {
      return;
    }

    if (activeNote.id === notesSnapshot.activeNoteId) {
      return;
    }

    setNotesSnapshot((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        activeNoteId: activeNote.id,
      };
    });
  }, [activeNote, notesSnapshot]);

  useEffect(() => {
    setUseSampleNote(false);
  }, [activeNote?.id]);

  useEffect(() => {
    setSummaryStatus("idle");
    setSummaryError(null);
    setSummaryDownloadProgress(null);
    setSummaryWorkingNoteId(null);
  }, [activeNote?.id]);

  useEffect(() => {
    return () => {
      try {
        summarizerRef.current?.destroy?.();
      } catch {
        // Ignore cleanup errors.
      }
      summarizerRef.current = null;
    };
  }, []);

  const persistSnapshot = useCallback(async () => {
    const snapshot = latestSnapshotRef.current;

    if (!snapshot) {
      return;
    }

    await persistNotesSnapshot(snapshot);

    if (directoryHandle) {
      const noteToSync = snapshot.notes.find((note) =>
        note.id === snapshot.activeNoteId
      ) ?? null;

      if (noteToSync) {
        try {
          await writeNoteToDirectory(directoryHandle, noteToSync);
          setDiskSyncMessage(`Synced ${noteToSync.title}`);
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : "Could not write files.";
          setDiskSyncMessage(`Disk sync error: ${message}`);
        }
      }
    }

    setLastPersistedAt(new Date().toISOString());
    setHasPendingAutosave(false);
  }, [directoryHandle]);

  const applyEditorSnapshot = useCallback((snapshot: NoteEditorSnapshot) => {
    setNotesSnapshot((previous) => {
      if (!previous) {
        return previous;
      }

      const activeIndex = previous.notes.findIndex((note) =>
        note.id === previous.activeNoteId
      );

      if (activeIndex < 0) {
        return previous;
      }

      const current = previous.notes[activeIndex];
      const updatedAt = new Date().toISOString();
      const updatedNote = {
        ...current,
        title: resolveNoteTitle(snapshot.json, snapshot.html),
        updatedAt,
        contentJson: snapshot.json,
        contentHtml: snapshot.html,
        plainText: snapshot.plainText,
        sizeBytes: estimateNoteSizeBytes(
          snapshot.json,
          snapshot.html,
          snapshot.plainText,
        ),
      };

      const notes = [...previous.notes];
      notes[activeIndex] = updatedNote;
      notes.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt)
      );

      return {
        ...previous,
        activeNoteId: updatedNote.id,
        notes,
      };
    });

    setHasPendingAutosave(true);
  }, []);

  useEffect(() => {
    if (!notesLoaded || !hasPendingAutosave) {
      return;
    }

    if (autosaveTimerRef.current !== null) {
      globalThis.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = globalThis.setTimeout(() => {
      void persistSnapshot();
    }, AUTOSAVE_IDLE_MS);

    return () => {
      if (autosaveTimerRef.current !== null) {
        globalThis.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [hasPendingAutosave, notesLoaded, notesSnapshot, persistSnapshot]);

  useEffect(() => {
    const flushIfNeeded = () => {
      if (!hasPendingAutosave) {
        return;
      }

      if (autosaveTimerRef.current !== null) {
        globalThis.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      void persistSnapshot();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushIfNeeded();
      }
    };

    globalThis.addEventListener("beforeunload", flushIfNeeded);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      globalThis.removeEventListener("beforeunload", flushIfNeeded);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [hasPendingAutosave, persistSnapshot]);

  useEffect(() => {
    if (!notePickerOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const container = notePickerRef.current;

      if (!container) {
        return;
      }

      if (event.target instanceof Node && !container.contains(event.target)) {
        setNotePickerOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [notePickerOpen]);

  useEffect(() => {
    if (activePanel === "editor") {
      return;
    }

    if (!notePickerOpen) {
      return;
    }

    setNotePickerOpen(false);
  }, [activePanel, notePickerOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const syncMode = (event?: MediaQueryListEvent) => {
      setSystemPrefersDark(event?.matches ?? mediaQuery.matches);
    };

    syncMode();
    mediaQuery.addEventListener("change", syncMode);
    return () => mediaQuery.removeEventListener("change", syncMode);
  }, []);

  const resolvedMode = mode === "system"
    ? (systemPrefersDark ? "dark" : "light")
    : mode;

  const resetAppearance = () => {
    setMode(defaultAppearanceSettings.mode);
    setBgPalette(defaultAppearanceSettings.bgPalette);
    setPalette(defaultAppearanceSettings.palette);
    setAccentColor(defaultAppearanceSettings.accentColor);
    setAlertSuccessTone(defaultAppearanceSettings.alertSuccessTone);
    setAlertSuccessStrength(defaultAppearanceSettings.alertSuccessStrength);
    setAlertInfoTone(defaultAppearanceSettings.alertInfoTone);
    setAlertInfoStrength(defaultAppearanceSettings.alertInfoStrength);
    setAlertWarningTone(defaultAppearanceSettings.alertWarningTone);
    setAlertWarningStrength(defaultAppearanceSettings.alertWarningStrength);
    setAlertDangerTone(defaultAppearanceSettings.alertDangerTone);
    setBodyFont(defaultAppearanceSettings.bodyFont);
    setHeadingFont(defaultAppearanceSettings.headingFont);
    setFontScale(defaultAppearanceSettings.fontScale);
    setRadius(defaultAppearanceSettings.radius);
    setElevation(defaultAppearanceSettings.elevation);
    setUseSampleNote(false);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-mode", resolvedMode);
    root.setAttribute("data-mode-preference", mode);
    root.setAttribute("data-bg", bgPalette);
    root.setAttribute("data-palette", palette);
    root.setAttribute("data-accent", accentColor);
    root.setAttribute("data-alert-success", alertSuccessTone);
    root.setAttribute("data-alert-success-strength", alertSuccessStrength);
    root.setAttribute("data-alert-info", alertInfoTone);
    root.setAttribute("data-alert-info-strength", alertInfoStrength);
    root.setAttribute("data-alert-warning", alertWarningTone);
    root.setAttribute("data-alert-warning-strength", alertWarningStrength);
    root.setAttribute("data-alert-danger", alertDangerTone);
    root.setAttribute("data-body-font", bodyFont);
    root.setAttribute("data-heading-font", headingFont);
    root.setAttribute("data-font-scale", fontScale);
    root.setAttribute("data-radius", radius);
    root.setAttribute("data-elevation", elevation);
  }, [
    accentColor,
    alertDangerTone,
    alertInfoTone,
    alertInfoStrength,
    alertSuccessTone,
    alertSuccessStrength,
    alertWarningTone,
    alertWarningStrength,
    bgPalette,
    bodyFont,
    elevation,
    fontScale,
    headingFont,
    mode,
    palette,
    radius,
    resolvedMode,
  ]);

  useEffect(() => {
    persistAppearanceSettings({
      mode,
      bgPalette,
      palette,
      accentColor,
      alertSuccessTone,
      alertSuccessStrength,
      alertInfoTone,
      alertInfoStrength,
      alertWarningTone,
      alertWarningStrength,
      alertDangerTone,
      bodyFont,
      headingFont,
      fontScale,
      radius,
      elevation,
    });
  }, [
    mode,
    bgPalette,
    palette,
    accentColor,
    alertSuccessTone,
    alertSuccessStrength,
    alertInfoTone,
    alertInfoStrength,
    alertWarningTone,
    alertWarningStrength,
    alertDangerTone,
    bodyFont,
    headingFont,
    fontScale,
    radius,
    elevation,
  ]);

  useEffect(() => {
    ensureRuntimeFonts(bodyFont, headingFont);
  }, [bodyFont, headingFont]);

  const pickerNotes = useMemo(() => {
    if (!notesSnapshot) {
      return [];
    }

    return notesSnapshot.notes.filter((note) =>
      noteMatchesQuery(note, notePickerQuery)
    );
  }, [notePickerQuery, notesSnapshot]);

  const homeNotes = useMemo(() => {
    if (!notesSnapshot) {
      return [];
    }

    return notesSnapshot.notes.filter((note) =>
      noteMatchesQuery(note, homeSearchQuery)
    );
  }, [homeSearchQuery, notesSnapshot]);

  const createAndSwitchToNote = useCallback(() => {
    const newNote = createBlankNote();

    setNotesSnapshot((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        activeNoteId: newNote.id,
        notes: [newNote, ...previous.notes],
      };
    });

    setHasPendingAutosave(true);
    setActivePanel("editor");
    setNotePickerOpen(false);
    setNotePickerQuery("");
    setHomeSearchQuery("");
  }, []);

  const switchNote = useCallback((noteId: string) => {
    setNotesSnapshot((previous) => {
      if (!previous || previous.activeNoteId === noteId) {
        return previous;
      }

      return {
        ...previous,
        activeNoteId: noteId,
      };
    });

    setNotePickerOpen(false);
    setNotePickerQuery("");
  }, []);

  const openNoteInEditor = useCallback((noteId: string) => {
    switchNote(noteId);
    setActivePanel("editor");
  }, [switchNote]);

  const duplicateNote = useCallback((noteId: string) => {
    setNotesSnapshot((previous) => {
      if (!previous) {
        return previous;
      }

      const source = previous.notes.find((note) => note.id === noteId);
      if (!source) {
        return previous;
      }

      const duplicate = createBlankNote();
      const now = new Date().toISOString();
      const clonedJson = source.contentJson
        ? (typeof structuredClone === "function"
          ? structuredClone(source.contentJson)
          : JSON.parse(JSON.stringify(source.contentJson)))
        : null;
      const duplicateTitle = source.title.trim().length > 0
        ? `${source.title} (Copy)`
        : "Untitled note (Copy)";
      const nextNote = {
        ...duplicate,
        title: duplicateTitle,
        createdAt: now,
        updatedAt: now,
        summary: source.summary,
        summaryUpdatedAt: source.summaryUpdatedAt,
        contentHtml: source.contentHtml,
        contentJson: clonedJson,
        plainText: source.plainText,
        tabGroup: source.tabGroup ? { ...source.tabGroup } : null,
      };

      nextNote.sizeBytes = estimateNoteSizeBytes(
        nextNote.contentJson,
        nextNote.contentHtml,
        nextNote.plainText,
      );

      return {
        ...previous,
        activeNoteId: nextNote.id,
        notes: [nextNote, ...previous.notes],
      };
    });

    setHasPendingAutosave(true);
    setNotePickerOpen(false);
    setNotePickerQuery("");
    setHomeSearchQuery("");
    setActivePanel("editor");
  }, []);

  const deleteNote = useCallback((noteId: string) => {
    setNotesSnapshot((previous) => {
      if (!previous) {
        return previous;
      }

      const remainingNotes = previous.notes.filter((note) =>
        note.id !== noteId
      );

      if (remainingNotes.length === previous.notes.length) {
        return previous;
      }

      if (remainingNotes.length === 0) {
        const replacement = createBlankNote();

        return {
          ...previous,
          activeNoteId: replacement.id,
          notes: [replacement],
        };
      }

      const nextActiveNoteId = previous.activeNoteId === noteId
        ? remainingNotes[0].id
        : previous.activeNoteId;

      return {
        ...previous,
        activeNoteId: nextActiveNoteId,
        notes: remainingNotes,
      };
    });

    setHasPendingAutosave(true);
    setNotePickerOpen(false);
    setNotePickerQuery("");
    setHomeSearchQuery("");
  }, []);

  const refreshActiveNoteSummary = useCallback(async () => {
    if (!activeNote) {
      return;
    }

    const inputText = summarySourceText(activeNote);
    if (inputText.length === 0) {
      setSummaryStatus("error");
      setSummaryError("Add some note content before generating a summary.");
      setSummaryDownloadProgress(null);
      setSummaryWorkingNoteId(activeNote.id);
      return;
    }

    const summarizerApi =
      (globalThis as { Summarizer?: SummarizerApi }).Summarizer;
    if (!summarizerApi) {
      setSummaryStatus("error");
      setSummaryError(
        "Summarizer API is unavailable. Use Chrome 138+ with built-in AI enabled.",
      );
      setSummaryDownloadProgress(null);
      setSummaryWorkingNoteId(activeNote.id);
      return;
    }

    setSummaryStatus("checking");
    setSummaryError(null);
    setSummaryDownloadProgress(null);
    setSummaryWorkingNoteId(activeNote.id);

    try {
      const availability = await summarizerApi.availability();
      if (availability === "unavailable") {
        setSummaryStatus("error");
        setSummaryError("Summarizer model is not available on this device.");
        return;
      }

      let summarizer = summarizerRef.current;
      if (!summarizer) {
        if (availability === "downloadable" || availability === "downloading") {
          setSummaryStatus("downloading");
        } else {
          setSummaryStatus("generating");
        }

        summarizer = await summarizerApi.create({
          type: "key-points",
          format: "markdown",
          length: "short",
          preference: "capability",
          sharedContext:
            "Summarize this personal note into concise, practical key points for quick recall.",
          monitor(monitor) {
            monitor.addEventListener("downloadprogress", (event) => {
              const loaded = Number(event.loaded);
              setSummaryStatus("downloading");
              setSummaryDownloadProgress(
                Number.isFinite(loaded)
                  ? Math.round(Math.min(1, Math.max(0, loaded)) * 100)
                  : null,
              );
            });
          },
        });

        summarizerRef.current = summarizer;
      }

      setSummaryStatus("generating");

      const summary = await summarizer.summarize(inputText, {
        context:
          "This summary appears at the top of the note and should be action-oriented.",
      });
      const normalizedSummary = summary.trim();

      if (normalizedSummary.length === 0) {
        throw new Error("The summarizer returned an empty summary.");
      }

      const summarizedAt = new Date().toISOString();
      const noteId = activeNote.id;

      setNotesSnapshot((previous) => {
        if (!previous) {
          return previous;
        }

        const noteIndex = previous.notes.findIndex((note) =>
          note.id === noteId
        );
        if (noteIndex < 0) {
          return previous;
        }

        const nextNotes = [...previous.notes];
        nextNotes[noteIndex] = {
          ...nextNotes[noteIndex],
          summary: normalizedSummary,
          summaryUpdatedAt: summarizedAt,
        };

        return {
          ...previous,
          notes: nextNotes,
        };
      });

      setHasPendingAutosave(true);
      setSummaryStatus("idle");
      setSummaryDownloadProgress(null);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Could not generate summary.";
      setSummaryStatus("error");
      setSummaryError(message);
    }
  }, [activeNote]);

  const connectDiskFolder = useCallback(async () => {
    const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;

    if (!picker) {
      setDiskSyncMessage("Folder picker is not available in this context.");
      return;
    }

    try {
      const selectedDirectory = await picker({ mode: "readwrite" });
      setDirectoryHandle(selectedDirectory);
      setDiskSyncMessage(`Connected: ${selectedDirectory.name}`);

      const snapshot = latestSnapshotRef.current;
      if (!snapshot) {
        return;
      }

      const noteToSync = snapshot.notes.find((note) =>
        note.id === snapshot.activeNoteId
      ) ?? null;
      if (!noteToSync) {
        return;
      }

      await writeNoteToDirectory(selectedDirectory, noteToSync);
      setDiskSyncMessage(
        `Connected: ${selectedDirectory.name} (synced latest note)`,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      const message = error instanceof Error
        ? error.message
        : "Unable to connect folder.";
      setDiskSyncMessage(`Disk sync error: ${message}`);
    }
  }, []);

  const handleSourceContextLinkClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const href = anchor.getAttribute("href") ?? "";
      const parsed = parseSourceHref(href);

      if (!parsed) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const openFallback = () => {
        globalThis.open(parsed.url, "_blank", "noopener,noreferrer");
      };

      const chromeApi = (globalThis as {
        chrome?: {
          runtime?: {
            id?: string;
            lastError?: { message?: string };
            sendMessage?: (
              message: unknown,
              response?: (value?: unknown) => void,
            ) => void;
          };
        };
      }).chrome;

      if (
        !chromeApi?.runtime?.id ||
        typeof chromeApi.runtime.sendMessage !== "function"
      ) {
        openFallback();
        return;
      }

      try {
        chromeApi.runtime.sendMessage(
          {
            type: "void-note.open-source",
            payload: parsed,
          },
          () => {
            if (chromeApi.runtime?.lastError) {
              openFallback();
            }
          },
        );
      } catch {
        openFallback();
      }
    },
    [],
  );

  const saveStatus = hasPendingAutosave
    ? `Saving after ${Math.round(AUTOSAVE_IDLE_MS / 1000)}s idle`
    : lastPersistedAt
    ? `Saved ${formatEditedTimestamp(lastPersistedAt)}`
    : "Not saved yet";
  const isSummarizingCurrentNote = Boolean(
    activeNote && summaryWorkingNoteId === activeNote.id &&
      (summaryStatus === "checking" || summaryStatus === "downloading" ||
        summaryStatus === "generating"),
  );
  const summaryIsStale = Boolean(
    activeNote?.summary &&
      activeNote.summaryUpdatedAt &&
      activeNote.updatedAt.localeCompare(activeNote.summaryUpdatedAt) > 0,
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 md:px-8 md:py-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-border bg-surface p-0.5 shadow-soft">
          <button
            type="button"
            className={[
              "h-7 rounded-[calc(var(--radius-md)_-_2px)] px-2.5 text-xs font-medium transition",
              activePanel === "home"
                ? "bg-accent/15 text-fg"
                : "text-muted hover:text-fg",
            ].join(" ")}
            onClick={() => setActivePanel("home")}
          >
            Home
          </button>
          <button
            type="button"
            className={[
              "h-7 rounded-[calc(var(--radius-md)_-_2px)] px-2.5 text-xs font-medium transition",
              activePanel === "editor"
                ? "bg-accent/15 text-fg"
                : "text-muted hover:text-fg",
            ].join(" ")}
            onClick={() => setActivePanel("editor")}
            disabled={!activeNote}
          >
            Editor
          </button>
        </div>

        {activePanel === "editor"
          ? (
            <div className="relative" ref={notePickerRef}>
              <button
                type="button"
                className="inline-flex h-8 max-w-[18rem] items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-fg shadow-soft transition hover:bg-surface-2"
                onClick={() => setNotePickerOpen((open) => !open)}
                aria-expanded={notePickerOpen}
              >
                <span className="truncate">
                  {activeNote?.title ?? "Loading notes..."}
                </span>
                <TbChevronDown aria-hidden size={16} strokeWidth={1.9} />
              </button>

              {notePickerOpen
                ? (
                  <div className="absolute left-0 top-[calc(100%+0.4rem)] z-40 w-[min(26rem,calc(100vw-2.5rem))] rounded-lg border border-border bg-surface p-2 shadow-elevated">
                    <div className="flex items-center gap-2">
                      <input
                        type="search"
                        value={notePickerQuery}
                        onChange={(event) =>
                          setNotePickerQuery(event.target.value)}
                        placeholder="Search notes"
                        className="h-8 flex-1 rounded-md border border-border bg-surface px-2.5 text-sm text-fg outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20"
                      />
                    </div>

                    <div className="mt-2 max-h-72 overflow-y-auto">
                      {pickerNotes.length > 0
                        ? pickerNotes.map((note) => {
                          const isActive = note.id === activeNote?.id;

                          return (
                            <button
                              key={note.id}
                              type="button"
                              className={[
                                "grid w-full gap-0.5 rounded-md px-2.5 py-2 text-left transition",
                                isActive
                                  ? "bg-accent/12 text-fg"
                                  : "text-fg hover:bg-surface-2",
                              ].join(" ")}
                              onClick={() => switchNote(note.id)}
                            >
                              <span className="truncate text-sm font-medium">
                                {note.title}
                              </span>
                              <span className="text-xs text-muted">
                                Edited {formatEditedTimestamp(note.updatedAt)} •
                                {" "}
                                {formatBytes(note.sizeBytes)}
                              </span>
                            </button>
                          );
                        })
                        : (
                          <p className="px-2.5 py-3 text-sm text-muted">
                            No notes match this search.
                          </p>
                        )}
                    </div>
                  </div>
                )
                : null}
            </div>
          )
          : null}

        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-xs font-medium text-fg shadow-soft transition hover:bg-surface-2"
          onClick={createAndSwitchToNote}
        >
          <TbFilePlus aria-hidden size={14} strokeWidth={1.9} />
          New
        </button>

        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-fg shadow-soft transition hover:bg-surface-2"
          onClick={() => void connectDiskFolder()}
        >
          <TbFolder aria-hidden size={14} strokeWidth={1.9} />
          {directoryHandle ? "Change Folder" : "Connect Folder"}
        </button>

        <p className="text-xs text-muted">{saveStatus}</p>
      </div>

      <p className="mb-3 text-xs text-muted">{diskSyncMessage}</p>

      {activePanel === "home"
        ? (
          <section className="rounded-lg border border-border bg-surface p-3 shadow-soft">
            <div className="mb-2">
              <input
                type="search"
                value={homeSearchQuery}
                onChange={(event) => setHomeSearchQuery(event.target.value)}
                placeholder="Search notes"
                className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-fg outline-none transition focus-visible:ring-4 focus-visible:ring-ring/20"
              />
            </div>

            <div className="space-y-2">
              {homeNotes.length > 0
                ? homeNotes.map((note) => {
                  const isActive = note.id === activeNote?.id;

                  return (
                    <article
                      key={note.id}
                      className={[
                        "flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2",
                        isActive ? "bg-accent/10" : "bg-surface",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => openNoteInEditor(note.id)}
                      >
                        <p className="truncate text-sm font-medium text-fg">
                          {note.title}
                        </p>
                        <p
                          className="mt-0.5 text-sm text-muted"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {createNotePreview(note.title, note.plainText)}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Edited {formatEditedTimestamp(note.updatedAt)} •{" "}
                          {formatBytes(note.sizeBytes)}
                        </p>
                      </button>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          className="h-7 rounded-md border border-border px-2 text-xs font-medium text-fg transition hover:bg-surface-2"
                          onClick={() => openNoteInEditor(note.id)}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="h-7 rounded-md border border-border px-2 text-xs font-medium text-fg transition hover:bg-surface-2"
                          onClick={() => duplicateNote(note.id)}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="h-7 rounded-md border border-danger/35 px-2 text-xs font-medium text-danger transition hover:bg-danger/10"
                          onClick={() => {
                            const confirmed = globalThis.confirm(
                              `Delete note "${note.title}"?`,
                            );
                            if (!confirmed) {
                              return;
                            }
                            deleteNote(note.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })
                : (
                  <p className="rounded-md border border-border bg-surface-2 px-3 py-4 text-sm text-muted">
                    {notesLoaded
                      ? "No notes match this search."
                      : "Loading notes..."}
                  </p>
                )}
            </div>
          </section>
        )
        : activeNote
        ? (
          <div
            className="space-y-3"
            onClickCapture={handleSourceContextLinkClick}
          >
            <section className="rounded-lg border border-border bg-surface px-3 py-2 shadow-soft">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                    Summary
                  </p>
                  <p className="text-xs text-muted">
                    {activeNote.summaryUpdatedAt
                      ? `Updated ${
                        formatEditedTimestamp(activeNote.summaryUpdatedAt)
                      }`
                      : "No summary yet"}
                    {summaryIsStale ? " • Note changed since last summary" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-fg shadow-soft transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void refreshActiveNoteSummary()}
                  disabled={isSummarizingCurrentNote}
                >
                  {isSummarizingCurrentNote
                    ? summaryStatus === "downloading"
                      ? `Downloading${
                        summaryDownloadProgress !== null
                          ? ` ${summaryDownloadProgress}%`
                          : ""
                      }`
                      : "Generating..."
                    : activeNote.summary
                    ? "Refresh"
                    : "Generate"}
                </button>
              </div>

              {summaryError && summaryWorkingNoteId === activeNote.id
                ? (
                  <p className="rounded-md border border-danger/35 bg-danger/8 px-2.5 py-2 text-sm text-danger">
                    {summaryError}
                  </p>
                )
                : (
                  <div className="rounded-md bg-surface-2 px-3 py-2">
                    {activeNote.summary?.trim().length
                      ? (
                        <div
                          className="note-editor"
                          dangerouslySetInnerHTML={{
                            __html: renderSummaryMarkdown(activeNote.summary),
                          }}
                        />
                      )
                      : (
                        <p className="text-sm text-muted">
                          Generate a note summary to see key points here.
                        </p>
                      )}
                  </div>
                )}
            </section>

            <NoteEditor
              key={`${activeNote.id}:${externalContentRevision}`}
              initialContent={activeNote.contentJson ?? activeNote.contentHtml}
              onContentSnapshotChange={applyEditorSnapshot}
              useSampleNote={useSampleNote}
              onUseSampleNoteChange={setUseSampleNote}
              mode={mode}
              bgPalette={bgPalette}
              palette={palette}
              accentColor={accentColor}
              alertSuccessTone={alertSuccessTone}
              alertSuccessStrength={alertSuccessStrength}
              alertInfoTone={alertInfoTone}
              alertInfoStrength={alertInfoStrength}
              alertWarningTone={alertWarningTone}
              alertWarningStrength={alertWarningStrength}
              alertDangerTone={alertDangerTone}
              bodyFont={bodyFont}
              headingFont={headingFont}
              fontScale={fontScale}
              radius={radius}
              elevation={elevation}
              onModeChange={setMode}
              onBgPaletteChange={setBgPalette}
              onPaletteChange={setPalette}
              onAccentColorChange={setAccentColor}
              onAlertSuccessToneChange={setAlertSuccessTone}
              onAlertSuccessStrengthChange={setAlertSuccessStrength}
              onAlertInfoToneChange={setAlertInfoTone}
              onAlertInfoStrengthChange={setAlertInfoStrength}
              onAlertWarningToneChange={setAlertWarningTone}
              onAlertWarningStrengthChange={setAlertWarningStrength}
              onAlertDangerToneChange={setAlertDangerTone}
              onBodyFontChange={setBodyFont}
              onHeadingFontChange={setHeadingFont}
              onFontScaleChange={setFontScale}
              onRadiusChange={setRadius}
              onElevationChange={setElevation}
              onResetAppearance={resetAppearance}
            />
          </div>
        )
        : (
          <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
            {notesLoaded ? "No note available." : "Loading notes..."}
          </div>
        )}
    </main>
  );
}

export default App;
