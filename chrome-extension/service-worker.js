const NOTES_STORAGE_KEY = "void-note.notes.v1";
const NOTE_SCHEMA_VERSION = 1;
const MENU_NAMESPACE = "void-note.v2";
const MENU_ROOT_ID = `${MENU_NAMESPACE}.append-root`;
const MENU_NEW_ID = `${MENU_NAMESPACE}.append-new`;
const MENU_EMPTY_ID = `${MENU_NAMESPACE}.append-empty`;
const MENU_SEPARATOR_ID = `${MENU_NAMESPACE}.append-separator`;
const MENU_NOTE_PREFIX = `${MENU_NAMESPACE}.append-note.`;
const SOURCE_LINK_PREFIX = "voidnote-source://open?";

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clipText(value, maxLength) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function truncateMenuTitle(value) {
  const title = clipText(value, 44);
  return title.length > 0 ? title : "Untitled note";
}

function plainTextFromQuote(rawText) {
  const value = String(rawText ?? "").trim();
  return value.length > 0 ? value : "Captured context";
}

function plainTextFromHtml(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateBytes(payload) {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  } catch {
    return 0;
  }
}

function storageGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (items) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }

      resolve(items?.[key] ?? null);
    });
  });
}

function storageSet(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(
            chrome.runtime.lastError.message || "Storage write failed.",
          ),
        );
        return;
      }

      resolve();
    });
  });
}

function contextMenusRemoveAll() {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(
            chrome.runtime.lastError.message ||
              "Could not clear context menus.",
          ),
        );
        return;
      }

      resolve();
    });
  });
}

function contextMenusCreate(options) {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create(options, () => {
      if (chrome.runtime.lastError) {
        const message = chrome.runtime.lastError.message ||
          `Failed to create menu ${options?.id}`;

        // Avoid noisy failures if a stale ID is already present; rebuilding can continue.
        if (message.toLowerCase().includes("duplicate id")) {
          resolve();
          return;
        }

        reject(new Error(message));
        return;
      }

      resolve();
    });
  });
}

function contextMenusRemove(menuId) {
  return new Promise((resolve) => {
    chrome.contextMenus.remove(menuId, () => {
      // Always read lastError to avoid unchecked runtime error noise.
      void chrome.runtime.lastError;
      resolve();
    });
  });
}

function tabsGet(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(chrome.runtime.lastError.message || "Tab lookup failed."),
        );
        return;
      }

      resolve(tab);
    });
  });
}

function tabsUpdate(tabId, updateProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, updateProperties, (tab) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(chrome.runtime.lastError.message || "Tab update failed."),
        );
        return;
      }

      resolve(tab);
    });
  });
}

function tabsCreate(createProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, (tab) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(chrome.runtime.lastError.message || "Tab create failed."),
        );
        return;
      }

      resolve(tab);
    });
  });
}

function windowsUpdate(windowId, updateInfo) {
  return new Promise((resolve, reject) => {
    chrome.windows.update(windowId, updateInfo, (window) => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(
            chrome.runtime.lastError.message || "Window update failed.",
          ),
        );
        return;
      }

      resolve(window);
    });
  });
}

function scriptingExecuteScript(tabId, func) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func,
      },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              chrome.runtime.lastError.message || "Script execution failed.",
            ),
          );
          return;
        }

        resolve(results || []);
      },
    );
  });
}

function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const snapshot = raw;

  if (
    snapshot.schemaVersion !== NOTE_SCHEMA_VERSION ||
    !Array.isArray(snapshot.notes)
  ) {
    return null;
  }

  const notes = snapshot.notes.filter((note) =>
    note && typeof note.id === "string"
  );

  if (notes.length === 0) {
    return null;
  }

  const activeNoteId = typeof snapshot.activeNoteId === "string" &&
      notes.some((note) => note.id === snapshot.activeNoteId)
    ? snapshot.activeNoteId
    : notes[0].id;

  return {
    schemaVersion: NOTE_SCHEMA_VERSION,
    activeNoteId,
    notes,
  };
}

async function loadSnapshot() {
  const raw = await storageGet(NOTES_STORAGE_KEY);
  const snapshot = normalizeSnapshot(raw);

  if (snapshot) {
    return snapshot;
  }

  return {
    schemaVersion: NOTE_SCHEMA_VERSION,
    activeNoteId: "",
    notes: [],
  };
}

async function persistSnapshot(snapshot) {
  await storageSet({
    [NOTES_STORAGE_KEY]: snapshot,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildTargetUrl(sourceUrl, selectionText) {
  const candidate = String(sourceUrl ?? "").trim();

  if (!candidate) {
    return "about:blank";
  }

  const text = clipText(String(selectionText ?? "").replace(/\s+/g, " "), 160);

  if (!text || !isHttpUrl(candidate)) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    parsed.hash = `:~:text=${encodeURIComponent(text)}`;
    return parsed.toString();
  } catch {
    return candidate;
  }
}

function buildSourceHref(targetUrl, tabId, windowId) {
  const params = new URLSearchParams();
  params.set("url", targetUrl);

  if (typeof tabId === "number") {
    params.set("tabId", String(tabId));
  }

  if (typeof windowId === "number") {
    params.set("windowId", String(windowId));
  }

  return `${SOURCE_LINK_PREFIX}${params.toString()}`;
}

function parseSourceHref(href) {
  if (typeof href !== "string" || !href.startsWith(SOURCE_LINK_PREFIX)) {
    return null;
  }

  const query = href.slice(SOURCE_LINK_PREFIX.length);
  const params = new URLSearchParams(query);
  const url = params.get("url") ?? "";

  if (!url) {
    return null;
  }

  const tabIdValue = params.get("tabId");
  const windowIdValue = params.get("windowId");
  const tabId = tabIdValue && /^\d+$/.test(tabIdValue)
    ? Number(tabIdValue)
    : null;
  const windowId = windowIdValue && /^\d+$/.test(windowIdValue)
    ? Number(windowIdValue)
    : null;

  return {
    url,
    tabId,
    windowId,
  };
}

async function getSelectionPayloadFromTab(tabId) {
  if (typeof tabId !== "number") {
    return null;
  }

  try {
    const results = await scriptingExecuteScript(
      tabId,
      () => {
        const selection = globalThis.getSelection();

        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          return { html: "", text: "" };
        }

        const container = document.createElement("div");

        for (let index = 0; index < selection.rangeCount; index += 1) {
          const fragment = selection.getRangeAt(index).cloneContents();
          const wrapper = document.createElement("div");
          wrapper.append(fragment);
          container.append(...Array.from(wrapper.childNodes));
        }

        container.querySelectorAll(
          "script, style, noscript, iframe, object, embed",
        ).forEach((node) => {
          node.remove();
        });

        container.querySelectorAll("*").forEach((element) => {
          for (const attribute of Array.from(element.attributes)) {
            const name = attribute.name.toLowerCase();
            const value = attribute.value;

            if (name.startsWith("on") || name === "style") {
              element.removeAttribute(attribute.name);
              continue;
            }

            if (
              (name === "href" || name === "src") && value.trim().length > 0
            ) {
              try {
                element.setAttribute(
                  attribute.name,
                  new URL(value, location.href).toString(),
                );
              } catch {
                // Keep original value if URL resolution fails.
              }
            }
          }
        });

        return {
          html: container.innerHTML.trim(),
          text: selection.toString().trim(),
        };
      },
    );

    const result = results[0]?.result;

    if (!result || typeof result !== "object") {
      return null;
    }

    return {
      html: String(result.html || ""),
      text: String(result.text || ""),
    };
  } catch {
    return null;
  }
}

function buildQuotePayload(info, tab, selectionPayload) {
  const sourceUrl = String(info.pageUrl || info.linkUrl || tab?.url || "")
    .trim();

  if (!sourceUrl) {
    return null;
  }

  const selectionText = String(info.selectionText || "").trim() ||
    String(selectionPayload?.text || "").trim();
  const quoteHtml = String(selectionPayload?.html || "").trim();
  const quoteText = plainTextFromQuote(
    selectionText || plainTextFromHtml(quoteHtml) || tab?.title || sourceUrl,
  );
  const targetUrl = buildTargetUrl(sourceUrl, selectionText);

  let sourceLabel = String(tab?.title || "").trim();
  if (!sourceLabel) {
    try {
      sourceLabel = new URL(sourceUrl).hostname;
    } catch {
      sourceLabel = "Source";
    }
  }

  return {
    sourceUrl,
    targetUrl,
    sourceLabel: clipText(sourceLabel, 90),
    quoteText,
    quoteHtml,
    sourceHref: buildSourceHref(targetUrl, tab?.id, tab?.windowId),
    tabGroup: typeof tab?.groupId === "number" && tab.groupId >= 0
      ? {
        groupId: tab.groupId,
        windowId: typeof tab?.windowId === "number" ? tab.windowId : undefined,
      }
      : null,
  };
}

function createQuoteNode(payload) {
  return {
    type: "blockquote",
    attrs: {
      value: payload.sourceLabel,
      href: payload.sourceHref,
    },
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: payload.quoteText,
          },
        ],
      },
    ],
  };
}

function createQuoteHtml(payload) {
  const safeLabel = escapeHtml(payload.sourceLabel);
  const safeHref = escapeHtml(payload.sourceHref);
  const safeText = escapeHtml(payload.quoteText);
  const quoteBodyHtml =
    typeof payload.quoteHtml === "string" && payload.quoteHtml.trim().length > 0
      ? payload.quoteHtml
      : `<p>${safeText}</p>`;

  return [
    `<blockquote data-type="quoteBlock" data-quote-footer-value="${safeLabel}" data-quote-footer-href="${safeHref}">`,
    '<div data-quote-content="">',
    quoteBodyHtml,
    "</div>",
    `<footer data-quote-footer="" data-quote-footer-kind="link"><a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a></footer>`,
    "</blockquote>",
  ].join("");
}

function ensureDoc(note) {
  const incoming = note.contentJson;

  if (incoming && typeof incoming === "object" && incoming.type === "doc") {
    let cloned;

    try {
      cloned = structuredClone(incoming);
    } catch {
      cloned = JSON.parse(JSON.stringify(incoming));
    }

    if (!Array.isArray(cloned.content)) {
      cloned.content = [];
    }

    return cloned;
  }

  return null;
}

function makeHeadingNode(title) {
  return {
    type: "heading",
    attrs: { level: 1 },
    content: [{ type: "text", text: title }],
  };
}

function appendQuoteToNote(note, payload) {
  const next = { ...note };
  const doc = ensureDoc(note);
  const hasRichQuoteHtml = typeof payload.quoteHtml === "string" &&
    payload.quoteHtml.trim().length > 0;

  if (hasRichQuoteHtml) {
    const existingHtml = typeof next.contentHtml === "string"
      ? next.contentHtml
      : "";
    const separator = existingHtml.trim().length > 0 ? "\n" : "";
    next.contentHtml = `${existingHtml}${separator}${createQuoteHtml(payload)}`;
    next.contentJson = null;
  } else if (doc) {
    if (!Array.isArray(doc.content) || doc.content.length === 0) {
      doc.content = [makeHeadingNode(next.title || "Untitled note")];
    }

    doc.content.push(createQuoteNode(payload));
    next.contentJson = doc;
  } else {
    const existingHtml = typeof next.contentHtml === "string"
      ? next.contentHtml
      : "";
    const separator = existingHtml.trim().length > 0 ? "\n" : "";
    next.contentHtml = `${existingHtml}${separator}${createQuoteHtml(payload)}`;
  }

  const previousText = String(next.plainText || "").trim();
  const nextQuoteText = `> ${payload.quoteText}`;
  next.plainText = previousText.length > 0
    ? `${previousText}\n\n${nextQuoteText}`
    : nextQuoteText;
  next.updatedAt = nowIso();
  next.tabGroup = payload.tabGroup;
  next.sizeBytes = estimateBytes({
    contentJson: next.contentJson,
    contentHtml: next.contentHtml,
    plainText: next.plainText,
  });

  return next;
}

function deriveNewNoteTitle(payload) {
  const fromTabTitle = clipText(payload.sourceLabel, 72);
  if (fromTabTitle) {
    return fromTabTitle;
  }

  return "Web capture";
}

function createNewNoteFromQuote(payload) {
  const noteTitle = deriveNewNoteTitle(payload);
  const timestamp = nowIso();
  const hasRichQuoteHtml = typeof payload.quoteHtml === "string" &&
    payload.quoteHtml.trim().length > 0;

  const doc = {
    type: "doc",
    content: [
      makeHeadingNode(noteTitle),
      createQuoteNode(payload),
    ],
  };

  const note = {
    id: generateId(),
    title: noteTitle,
    createdAt: timestamp,
    updatedAt: timestamp,
    sizeBytes: 0,
    contentHtml: [
      `<h1>${escapeHtml(noteTitle)}</h1>`,
      createQuoteHtml(payload),
    ].join("\n"),
    contentJson: hasRichQuoteHtml ? null : doc,
    plainText: `> ${payload.quoteText}`,
    tabGroup: payload.tabGroup,
  };

  note.sizeBytes = estimateBytes({
    contentJson: note.contentJson,
    contentHtml: note.contentHtml,
    plainText: note.plainText,
  });

  return note;
}

function sortNotesByUpdatedAt(notes) {
  notes.sort((left, right) => {
    const leftValue = String(left.updatedAt || "");
    const rightValue = String(right.updatedAt || "");
    return rightValue.localeCompare(leftValue);
  });
}

let contextMenuRebuildQueue = Promise.resolve();

async function cleanupLegacyContextMenus() {
  const legacyIds = [
    "void-note.append-root",
    "void-note.append-new",
    "void-note.append-empty",
    "void-note.append-separator",
  ];

  await Promise.all(legacyIds.map((menuId) => contextMenusRemove(menuId)));
}

function requestContextMenuRebuild() {
  contextMenuRebuildQueue = contextMenuRebuildQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        await cleanupLegacyContextMenus();
        await rebuildContextMenus();
      } catch (error) {
        console.error("Failed to rebuild context menus", error);
      }
    });

  return contextMenuRebuildQueue;
}

async function rebuildContextMenus() {
  await contextMenusRemoveAll();

  const contexts = ["page", "selection", "link"];

  await contextMenusCreate({
    id: MENU_ROOT_ID,
    title: "Append to Void Note",
    contexts,
  });

  await contextMenusCreate({
    id: MENU_NEW_ID,
    parentId: MENU_ROOT_ID,
    title: "Append to New Void Note",
    contexts,
  });

  const snapshot = await loadSnapshot();
  const notes = Array.isArray(snapshot.notes) ? snapshot.notes : [];

  if (notes.length === 0) {
    await contextMenusCreate({
      id: MENU_EMPTY_ID,
      parentId: MENU_ROOT_ID,
      title: "No notes yet",
      enabled: false,
      contexts,
    });

    return;
  }

  await contextMenusCreate({
    id: MENU_SEPARATOR_ID,
    parentId: MENU_ROOT_ID,
    type: "separator",
    contexts,
  });

  for (const note of notes.slice(0, 20)) {
    await contextMenusCreate({
      id: `${MENU_NOTE_PREFIX}${note.id}`,
      parentId: MENU_ROOT_ID,
      title: `Append to ${truncateMenuTitle(note.title)}`,
      contexts,
    });
  }
}

async function appendCaptureToNote({ noteId, createNew, info, tab }) {
  const selectionPayload = await getSelectionPayloadFromTab(tab?.id);
  const payload = buildQuotePayload(info, tab, selectionPayload);

  if (!payload) {
    return;
  }

  const snapshot = await loadSnapshot();

  if (createNew || !noteId) {
    const newNote = createNewNoteFromQuote(payload);
    snapshot.notes = [
      newNote,
      ...snapshot.notes.filter((item) => item.id !== newNote.id),
    ];
    snapshot.activeNoteId = newNote.id;
  } else {
    const targetIndex = snapshot.notes.findIndex((note) => note.id === noteId);

    if (targetIndex < 0) {
      const fallbackNote = createNewNoteFromQuote(payload);
      snapshot.notes = [
        fallbackNote,
        ...snapshot.notes.filter((item) => item.id !== fallbackNote.id),
      ];
      snapshot.activeNoteId = fallbackNote.id;
    } else {
      const updated = appendQuoteToNote(snapshot.notes[targetIndex], payload);
      snapshot.notes[targetIndex] = updated;
      snapshot.activeNoteId = updated.id;
    }
  }

  sortNotesByUpdatedAt(snapshot.notes);
  await persistSnapshot(snapshot);
  await requestContextMenuRebuild();
}

async function openSourceWithFallback({ url, tabId, windowId }) {
  const targetUrl = String(url || "").trim();

  if (!targetUrl) {
    return;
  }

  if (typeof tabId === "number") {
    try {
      const existingTab = await tabsGet(tabId);

      if (typeof windowId === "number") {
        try {
          await windowsUpdate(windowId, { focused: true });
        } catch {
          // Ignore and continue.
        }
      } else if (typeof existingTab.windowId === "number") {
        try {
          await windowsUpdate(existingTab.windowId, { focused: true });
        } catch {
          // Ignore and continue.
        }
      }

      await tabsUpdate(tabId, {
        active: true,
        url: targetUrl,
      });
      return;
    } catch {
      // Fall through to creating a new tab.
    }
  }

  await tabsCreate({
    url: targetUrl,
    active: true,
  });
}

async function handleInstalled() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.error("Failed to configure side panel behavior", error);
  }

  await requestContextMenuRebuild();
}

chrome.runtime.onInstalled.addListener(() => {
  void handleInstalled();
});

chrome.runtime.onStartup.addListener(() => {
  void requestContextMenuRebuild();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[NOTES_STORAGE_KEY]) {
    return;
  }

  void requestContextMenuRebuild();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const menuId = String(info.menuItemId || "");

  if (menuId === MENU_NEW_ID) {
    void appendCaptureToNote({
      createNew: true,
      noteId: null,
      info,
      tab,
    });
    return;
  }

  if (menuId.startsWith(MENU_NOTE_PREFIX)) {
    const noteId = menuId.slice(MENU_NOTE_PREFIX.length);
    void appendCaptureToNote({
      createNew: false,
      noteId,
      info,
      tab,
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }

  if (message.type !== "void-note.open-source") {
    return false;
  }

  let payload = null;

  if (typeof message.href === "string") {
    payload = parseSourceHref(message.href);
  } else if (message.payload && typeof message.payload === "object") {
    payload = {
      url: message.payload.url,
      tabId: message.payload.tabId,
      windowId: message.payload.windowId,
    };
  }

  if (!payload) {
    sendResponse({ ok: false });
    return false;
  }

  void (async () => {
    try {
      await openSourceWithFallback(payload);
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Open failed.",
      });
    }
  })();

  return true;
});

void requestContextMenuRebuild();
