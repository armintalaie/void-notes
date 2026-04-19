import TaskItem from "@tiptap/extension-task-item";
import { getRenderedAttributes } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const SVG_NS = "http://www.w3.org/2000/svg";

export const statusValues = [
  "todo",
  "in_progress",
  "done",
  "archived",
] as const;

export type StatusValue = (typeof statusValues)[number];

function isStatusValue(value: string): value is StatusValue {
  return statusValues.includes(value as StatusValue);
}

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

function formatTaskDueDate(date: string | null, time: string | null): string {
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

const statusMeta: Record<StatusValue, { label: string }> = {
  todo: { label: "Todo" },
  in_progress: { label: "In progress" },
  done: { label: "Done" },
  archived: { label: "Archived" },
};

function createStatusIcon(status: StatusValue): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.9");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "9");
  svg.append(circle);

  if (status === "todo") {
    return svg;
  }

  if (status === "in_progress") {
    const half = document.createElementNS(SVG_NS, "path");
    half.setAttribute("d", "M12 3a9 9 0 0 1 0 18V3z");
    half.setAttribute("fill", "currentColor");
    half.setAttribute("stroke", "none");
    svg.append(half);
    return svg;
  }

  if (status === "done") {
    const check = document.createElementNS(SVG_NS, "polyline");
    check.setAttribute("points", "8 12 11 15 16 10");
    svg.append(check);
    return svg;
  }

  const slash = document.createElementNS(SVG_NS, "line");
  slash.setAttribute("x1", "7");
  slash.setAttribute("y1", "7");
  slash.setAttribute("x2", "17");
  slash.setAttribute("y2", "17");
  svg.append(slash);
  return svg;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    statusTaskItem: {
      setTaskStatus: (status: StatusValue) => ReturnType;
      setTaskDueDate: (value: {
        date?: string | null;
        time?: string | null;
      }) => ReturnType;
    };
  }
}

export const StatusTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      status: {
        default: "todo",
        parseHTML: (element) => {
          const status = element.getAttribute("data-status");

          if (status && isStatusValue(status)) {
            return status;
          }

          return element.getAttribute("data-checked") === "true"
            ? "done"
            : "todo";
        },
        renderHTML: (attributes) => {
          const status = isStatusValue(attributes.status)
            ? attributes.status
            : "todo";

          return {
            "data-status": status,
            "data-checked": status === "done" ? "true" : "false",
          };
        },
      },
      dueDate: {
        default: null,
        parseHTML: (element) =>
          normalizeDate(element.getAttribute("data-due-date")),
        renderHTML: (attributes) => ({
          "data-due-date": normalizeDate(attributes.dueDate),
        }),
      },
      dueTime: {
        default: null,
        parseHTML: (element) =>
          normalizeTime(element.getAttribute("data-due-time")),
        renderHTML: (attributes) => ({
          "data-due-time": normalizeTime(attributes.dueTime),
        }),
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setTaskStatus: (status: StatusValue) => ({ commands }) => {
        return commands.updateAttributes("taskItem", {
          status,
          checked: status === "done",
        });
      },
      setTaskDueDate: (value) => ({ commands }) => {
        return commands.updateAttributes("taskItem", {
          dueDate: normalizeDate(value.date) ?? null,
          dueTime: normalizeTime(value.time) ?? null,
        });
      },
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement("li");
      const statusControl = document.createElement("div");
      const statusTrigger = document.createElement("button");
      const statusMenu = document.createElement("div");
      const content = document.createElement("div");
      const dueRow = document.createElement("div");
      const dueTrigger = document.createElement("button");
      const duePanel = document.createElement("div");
      const duePanelTitle = document.createElement("p");
      const dueDateInput = document.createElement("input");
      const dueTimeInput = document.createElement("input");
      const dueActions = document.createElement("div");
      const dueSaveButton = document.createElement("button");
      const dueClearButton = document.createElement("button");

      let menuOpen = false;
      let dueMenuOpen = false;
      let draftDueDate: string | null = null;
      let draftDueTime: string | null = null;

      statusControl.className = "task-status-control";
      statusControl.contentEditable = "false";

      statusTrigger.type = "button";
      statusTrigger.className = "task-status-trigger";
      statusTrigger.contentEditable = "false";

      statusMenu.className = "task-status-menu";
      statusMenu.dataset.open = "false";
      statusMenu.contentEditable = "false";

      dueRow.className = "task-due-row";
      dueRow.dataset.open = "false";
      dueRow.contentEditable = "false";
      dueTrigger.type = "button";
      dueTrigger.className = "task-due-trigger";
      dueTrigger.contentEditable = "false";
      duePanel.className = "due-date-panel editor-inline-popover";
      duePanel.dataset.open = "false";
      duePanel.contentEditable = "false";
      duePanelTitle.className = "editor-inline-popover-title";
      duePanelTitle.textContent = "Due date";
      duePanelTitle.contentEditable = "false";
      dueDateInput.type = "date";
      dueDateInput.className = "due-date-input editor-inline-popover-input";
      dueDateInput.contentEditable = "false";
      dueTimeInput.type = "time";
      dueTimeInput.className = "due-date-input editor-inline-popover-input";
      dueTimeInput.step = "60";
      dueTimeInput.contentEditable = "false";
      dueActions.className = "editor-inline-popover-actions";
      dueActions.contentEditable = "false";
      dueSaveButton.type = "button";
      dueSaveButton.className =
        "editor-inline-popover-btn editor-inline-popover-btn-primary";
      dueSaveButton.textContent = "Save";
      dueSaveButton.contentEditable = "false";
      dueClearButton.type = "button";
      dueClearButton.className = "editor-inline-popover-btn";
      dueClearButton.textContent = "Clear";
      dueClearButton.contentEditable = "false";

      const closeMenu = () => {
        menuOpen = false;
        statusMenu.dataset.open = "false";
      };

      const openMenu = () => {
        if (!editor.isEditable) {
          return;
        }

        menuOpen = true;
        statusMenu.dataset.open = "true";
      };

      const closeDueMenu = () => {
        dueMenuOpen = false;
        duePanel.dataset.open = "false";
        dueRow.dataset.open = "false";
      };

      const openDueMenu = () => {
        if (!editor.isEditable) {
          return;
        }
        dueMenuOpen = true;
        duePanel.dataset.open = "true";
        dueRow.dataset.open = "true";
      };

      const setStatus = (status: StatusValue) => {
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
              status,
              checked: status === "done",
            });

            return true;
          })
          .run();
      };

      const setTaskDueDate = (
        value: { date: string | null; time: string | null },
      ) => {
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
              dueDate: value.date,
              dueTime: value.time,
            });

            return true;
          })
          .run();
      };

      const syncDueDraftFromInputs = () => {
        draftDueDate = normalizeDate(dueDateInput.value);
        draftDueTime = normalizeTime(dueTimeInput.value);
      };

      const syncStatusUI = (currentNode: ProseMirrorNode) => {
        const nextStatus = isStatusValue(currentNode.attrs.status)
          ? currentNode.attrs.status
          : currentNode.attrs.checked
          ? "done"
          : "todo";

        listItem.dataset.status = nextStatus;
        listItem.dataset.checked = String(nextStatus === "done");
        statusTrigger.dataset.status = nextStatus;
        statusTrigger.replaceChildren(createStatusIcon(nextStatus));
        statusTrigger.ariaLabel = `Status: ${statusMeta[nextStatus].label}`;
        const dueDate = normalizeDate(currentNode.attrs.dueDate);
        const dueTime = normalizeTime(currentNode.attrs.dueTime);
        dueTrigger.textContent = formatTaskDueDate(dueDate, dueTime);
        dueTrigger.dataset.empty = String(!dueDate);
        dueDateInput.value = dueDate ?? "";
        dueTimeInput.value = dueTime ?? "";
        draftDueDate = dueDate;
        draftDueTime = dueTime;

        Array.from(statusMenu.querySelectorAll("button")).forEach((element) => {
          const button = element as HTMLButtonElement;
          button.dataset.active = String(button.dataset.status === nextStatus);
        });
      };

      const toggleMenu = (event: Event) => {
        event.preventDefault();
        event.stopPropagation?.();

        if (menuOpen) {
          closeMenu();
          return;
        }

        openMenu();
      };

      statusTrigger.addEventListener("pointerdown", toggleMenu);

      statusTrigger.addEventListener("keydown", (event) => {
        if (
          event.key !== "Enter" && event.key !== " " &&
          event.key !== "ArrowDown"
        ) {
          return;
        }

        event.preventDefault();
        openMenu();
      });

      dueTrigger.addEventListener("pointerdown", (event) => {
        event.preventDefault();
      });

      const toggleDueMenu = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();

        if (dueMenuOpen) {
          closeDueMenu();
          return;
        }

        openDueMenu();
      };

      dueTrigger.addEventListener("click", toggleDueMenu);

      dueDateInput.addEventListener("input", syncDueDraftFromInputs);
      dueDateInput.addEventListener("change", syncDueDraftFromInputs);
      dueTimeInput.addEventListener("input", syncDueDraftFromInputs);
      dueTimeInput.addEventListener("change", syncDueDraftFromInputs);

      statusValues.forEach((status) => {
        const option = document.createElement("button");

        option.type = "button";
        option.className = "task-status-option";
        option.dataset.status = status;
        const optionLabel = document.createElement("span");
        optionLabel.className = "task-status-option-label";
        optionLabel.textContent = statusMeta[status].label;
        option.append(createStatusIcon(status), optionLabel);
        option.contentEditable = "false";

        option.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setStatus(status);
          closeMenu();
        });

        statusMenu.append(option);
      });

      dueSaveButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        syncDueDraftFromInputs();
        setTaskDueDate({
          date: draftDueDate,
          time: draftDueTime,
        });
        closeDueMenu();
      });

      dueClearButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setTaskDueDate({ date: null, time: null });
        closeDueMenu();
      });

      const onDocumentPointerDown = (event: PointerEvent) => {
        const target = event.target;

        if (!(target instanceof Node)) {
          return;
        }
        if (statusControl.contains(target)) {
          return;
        }
        if (dueRow.contains(target)) {
          return;
        }

        closeMenu();
        closeDueMenu();
      };

      document.addEventListener("pointerdown", onDocumentPointerDown);

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value);
      });

      dueActions.append(dueSaveButton, dueClearButton);
      duePanel.append(duePanelTitle, dueDateInput, dueTimeInput, dueActions);
      dueRow.append(dueTrigger, duePanel);
      statusControl.append(statusTrigger, statusMenu);
      listItem.append(statusControl, content, dueRow);

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value);
      });

      syncStatusUI(node);

      let prevRenderedAttributeKeys = new Set(Object.keys(HTMLAttributes));

      return {
        dom: listItem,
        contentDOM: content,
        stopEvent: (event) => {
          const target = event.target;

          return target instanceof Node &&
            (statusControl.contains(target) || dueRow.contains(target));
        },
        ignoreMutation: (mutation) => {
          const target = mutation.target;

          return target instanceof Node &&
            (statusControl.contains(target) || dueRow.contains(target));
        },
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }

          syncStatusUI(updatedNode);

          const extensionAttributes = editor.extensionManager.attributes;
          const newHTMLAttributes = getRenderedAttributes(
            updatedNode,
            extensionAttributes,
          );
          const newKeys = new Set(Object.keys(newHTMLAttributes));
          const staticAttrs = this.options.HTMLAttributes;

          prevRenderedAttributeKeys.forEach((key) => {
            if (!newKeys.has(key)) {
              if (key in staticAttrs) {
                listItem.setAttribute(key, staticAttrs[key]);
              } else {
                listItem.removeAttribute(key);
              }
            }
          });

          Object.entries(newHTMLAttributes).forEach(([key, value]) => {
            if (value === null || value === undefined) {
              if (key in staticAttrs) {
                listItem.setAttribute(key, staticAttrs[key]);
              } else {
                listItem.removeAttribute(key);
              }
            } else {
              listItem.setAttribute(key, value);
            }
          });

          prevRenderedAttributeKeys = newKeys;

          return true;
        },
        destroy: () => {
          statusTrigger.removeEventListener("pointerdown", toggleMenu);
          dueTrigger.removeEventListener("click", toggleDueMenu);
          document.removeEventListener("pointerdown", onDocumentPointerDown);
        },
      };
    };
  },
});
