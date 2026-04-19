import { getRenderedAttributes, mergeAttributes, Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

type DueDateValue = {
  date: string | null;
  time: string | null;
};

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return /^\d{2}:\d{2}$/.test(value) ? value : null;
}

function formatDueDate(value: DueDateValue): string {
  const { date, time } = value;

  if (!date) {
    return "Set due date";
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);
  const dateLabel = Number.isNaN(parsedDate.getTime())
    ? date
    : new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsedDate);

  if (!time) {
    return `Due ${dateLabel}`;
  }

  const [hours, minutes] = time.split(":").map(Number);
  const parsedTime = new Date(2000, 0, 1, hours, minutes);
  const timeLabel = Number.isNaN(parsedTime.getTime())
    ? time
    : new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(parsedTime);

  return `Due ${dateLabel} at ${timeLabel}`;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    dueDate: {
      wrapWithDueDate: (value?: Partial<DueDateValue>) => ReturnType;
      setDueDate: (value: Partial<DueDateValue>) => ReturnType;
      unsetDueDate: () => ReturnType;
    };
  }
}

export const DueDate = Node.create({
  name: "dueDate",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      date: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          normalizeDate(element.getAttribute("data-due-date")),
        renderHTML: (attributes: { date?: string | null }) => ({
          "data-due-date": normalizeDate(attributes.date),
        }),
      },
      time: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          normalizeTime(element.getAttribute("data-due-time")),
        renderHTML: (attributes: { time?: string | null }) => ({
          "data-due-time": normalizeTime(attributes.time),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="dueDate"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const value = {
      date: normalizeDate(node.attrs.date),
      time: normalizeTime(node.attrs.time),
    };

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": this.name,
        "data-empty": value.date ? "false" : "true",
      }),
      ["div", { "data-due-content": "" }, 0],
      ["div", { "data-due-meta": "" }, formatDueDate(value)],
    ];
  },

  addCommands() {
    return {
      wrapWithDueDate: (value = {}) => ({ chain, editor }) => {
        const nextDate = normalizeDate(value.date) ?? null;
        const nextTime = normalizeTime(value.time) ?? null;

        if (editor.isActive("taskItem")) {
          return chain().focus().setTaskDueDate({
            date: nextDate,
            time: nextTime,
          }).run();
        }

        if (editor.isActive(this.name)) {
          return chain().focus().updateAttributes(this.name, {
            date: nextDate,
            time: nextTime,
          }).run();
        }

        return chain().focus().wrapIn(this.name, {
          date: nextDate,
          time: nextTime,
        }).run();
      },
      setDueDate: (value) => ({ commands, editor }) => {
        const nextDate = normalizeDate(value.date) ?? null;
        const nextTime = normalizeTime(value.time) ?? null;

        if (editor.isActive("taskItem")) {
          return commands.setTaskDueDate({
            date: nextDate,
            time: nextTime,
          });
        }

        return commands.updateAttributes(this.name, {
          date: nextDate,
          time: nextTime,
        });
      },
      unsetDueDate: () => ({ commands, editor }) => {
        if (editor.isActive("taskItem")) {
          return commands.setTaskDueDate({ date: null, time: null });
        }
        if (!editor.isActive(this.name)) {
          return false;
        }

        return commands.lift(this.name);
      },
    };
  },

  addNodeView() {
    return ({ editor, node, getPos, HTMLAttributes }) => {
      const root = document.createElement("div");
      const content = document.createElement("div");
      const footer = document.createElement("div");
      const trigger = document.createElement("button");
      const panel = document.createElement("div");
      const panelTitle = document.createElement("p");
      const dateInput = document.createElement("input");
      const timeInput = document.createElement("input");
      const actions = document.createElement("div");
      const saveButton = document.createElement("button");
      const clearButton = document.createElement("button");
      const removeButton = document.createElement("button");

      let menuOpen = false;
      let draftDate: string | null = null;
      let draftTime: string | null = null;

      root.className = "due-date-block";

      content.className = "due-date-content";

      footer.className = "due-date-footer";
      footer.contentEditable = "false";

      trigger.type = "button";
      trigger.className = "due-date-trigger";
      trigger.contentEditable = "false";

      panel.className = "due-date-panel editor-inline-popover";
      panel.dataset.open = "false";
      panel.contentEditable = "false";

      panelTitle.className = "editor-inline-popover-title";
      panelTitle.textContent = "Due date";
      panelTitle.contentEditable = "false";

      dateInput.type = "date";
      dateInput.className = "due-date-input editor-inline-popover-input";
      dateInput.contentEditable = "false";

      timeInput.type = "time";
      timeInput.className = "due-date-input editor-inline-popover-input";
      timeInput.step = "60";
      timeInput.contentEditable = "false";

      actions.className = "editor-inline-popover-actions";
      actions.contentEditable = "false";

      saveButton.type = "button";
      saveButton.className =
        "editor-inline-popover-btn editor-inline-popover-btn-primary";
      saveButton.textContent = "Save";
      saveButton.contentEditable = "false";

      clearButton.type = "button";
      clearButton.className = "editor-inline-popover-btn";
      clearButton.textContent = "Clear";
      clearButton.contentEditable = "false";

      removeButton.type = "button";
      removeButton.className = "editor-inline-popover-btn";
      removeButton.textContent = "Remove context";
      removeButton.contentEditable = "false";

      const closeMenu = () => {
        menuOpen = false;
        panel.dataset.open = "false";
      };

      const openMenu = () => {
        if (!editor.isEditable) {
          return;
        }

        menuOpen = true;
        panel.dataset.open = "true";
      };

      const applyNodeAttrs = (nextValue: DueDateValue) => {
        if (!editor.isEditable || typeof getPos !== "function") {
          return;
        }

        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .command(({ tr }) => {
            const position = getPos();

            if (typeof position !== "number") {
              return false;
            }

            const currentNode = tr.doc.nodeAt(position);
            tr.setNodeMarkup(position, undefined, {
              ...currentNode?.attrs,
              date: nextValue.date,
              time: nextValue.time,
            });

            return true;
          })
          .run();
      };

      const syncDraftFromInputs = () => {
        draftDate = normalizeDate(dateInput.value);
        draftTime = normalizeTime(timeInput.value);
      };

      const removeWrapper = () => {
        if (!editor.isEditable || typeof getPos !== "function") {
          return;
        }

        const position = getPos();
        if (typeof position !== "number") {
          return;
        }

        editor.chain().focus().setNodeSelection(position).lift(this.name).run();
      };

      const syncUI = (updatedNode: ProseMirrorNode) => {
        const nextValue = {
          date: normalizeDate(updatedNode.attrs.date),
          time: normalizeTime(updatedNode.attrs.time),
        };

        trigger.textContent = formatDueDate(nextValue);
        trigger.dataset.empty = String(!nextValue.date);
        root.dataset.empty = String(!nextValue.date);
        dateInput.value = nextValue.date ?? "";
        timeInput.value = nextValue.time ?? "";
        draftDate = nextValue.date;
        draftTime = nextValue.time;
      };

      trigger.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (menuOpen) {
          closeMenu();
          return;
        }

        openMenu();
      });

      dateInput.addEventListener("input", syncDraftFromInputs);
      dateInput.addEventListener("change", syncDraftFromInputs);
      timeInput.addEventListener("input", syncDraftFromInputs);
      timeInput.addEventListener("change", syncDraftFromInputs);

      saveButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        syncDraftFromInputs();
        applyNodeAttrs({
          date: draftDate,
          time: draftTime,
        });
        closeMenu();
      });

      clearButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        applyNodeAttrs({ date: null, time: null });
        closeMenu();
      });

      removeButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        removeWrapper();
        closeMenu();
      });

      const onDocumentPointerDown = (event: PointerEvent) => {
        const target = event.target;

        if (!(target instanceof globalThis.Node)) {
          return;
        }
        if (root.contains(target)) {
          return;
        }

        closeMenu();
      };

      document.addEventListener("pointerdown", onDocumentPointerDown);

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        root.setAttribute(key, String(value));
      });

      actions.append(saveButton, clearButton, removeButton);
      panel.append(panelTitle, dateInput, timeInput, actions);
      footer.append(trigger, panel);
      root.append(content, footer);
      syncUI(node);

      let prevRenderedAttributeKeys = new Set(Object.keys(HTMLAttributes));

      return {
        dom: root,
        contentDOM: content,
        stopEvent: (event) => {
          const target = event.target;

          return target instanceof globalThis.Node && footer.contains(target);
        },
        ignoreMutation: (mutation) => {
          const target = mutation.target;

          return target instanceof Element && footer.contains(target);
        },
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }

          syncUI(updatedNode);

          const extensionAttributes = editor.extensionManager.attributes;
          const newHTMLAttributes = getRenderedAttributes(
            updatedNode,
            extensionAttributes,
          );
          const newKeys = new Set(Object.keys(newHTMLAttributes));

          prevRenderedAttributeKeys.forEach((key) => {
            if (!newKeys.has(key)) {
              root.removeAttribute(key);
            }
          });

          Object.entries(newHTMLAttributes).forEach(([key, value]) => {
            if (value === null || value === undefined) {
              root.removeAttribute(key);
            } else {
              root.setAttribute(key, String(value));
            }
          });

          prevRenderedAttributeKeys = newKeys;

          return true;
        },
        destroy: () => {
          document.removeEventListener("pointerdown", onDocumentPointerDown);
        },
      };
    };
  },
});
