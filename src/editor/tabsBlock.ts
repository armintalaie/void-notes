import { mergeAttributes, Node } from "@tiptap/core";

type PanelMeta = {
  index: number;
  title: string;
  offset: number;
  nodeSize: number;
};

function normalizeIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(index, length - 1));
}

function toTitle(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const next = value.trim();
  return next.length > 0 ? next : fallback;
}

type PopoverWithSource = HTMLElement & {
  showPopover: (options?: { source?: HTMLElement }) => void;
};

function showPopoverCompat(
  popover: HTMLElement,
  source?: HTMLElement,
): void {
  try {
    (popover as PopoverWithSource).showPopover(
      source ? { source } : undefined,
    );
    return;
  } catch {
    // Fall through to no-arg invocation for browsers that don't support options.
  }

  try {
    popover.showPopover();
  } catch {
    // Ignore when already open or unavailable.
  }
}

function positionPopover(
  trigger: HTMLElement,
  popover: HTMLElement,
): void {
  popover.style.position = "fixed";
  popover.style.inset = "auto";
  const viewportPadding = 10;
  const verticalGap = 6;

  requestAnimationFrame(() => {
    if (
      !popover.matches(":popover-open") &&
      popover.dataset.open !== "true"
    ) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const maxX = globalThis.innerWidth - popoverRect.width - viewportPadding;
    const maxY = globalThis.innerHeight - popoverRect.height - viewportPadding;
    const startAlignedX = triggerRect.left;
    const endAlignedX = triggerRect.right - popoverRect.width;
    const startFits = startAlignedX + popoverRect.width <=
      globalThis.innerWidth - viewportPadding;
    const endFits = endAlignedX >= viewportPadding;
    let sideX: "left" | "right" = "left";
    let targetX = startAlignedX;

    if (!startFits && endFits) {
      sideX = "right";
      targetX = endAlignedX;
    } else if (!startFits && !endFits) {
      const spaceAtStart = globalThis.innerWidth - triggerRect.left -
        viewportPadding;
      const spaceAtEnd = triggerRect.right - viewportPadding;
      if (spaceAtEnd > spaceAtStart) {
        sideX = "right";
        targetX = endAlignedX;
      }
    }

    const belowY = triggerRect.bottom + verticalGap;
    const aboveY = triggerRect.top - popoverRect.height - verticalGap;
    const belowFits =
      belowY + popoverRect.height <= globalThis.innerHeight - viewportPadding;
    const aboveFits = aboveY >= viewportPadding;
    let sideY: "top" | "bottom" = "bottom";
    let targetY = belowY;

    if (!belowFits && aboveFits) {
      sideY = "top";
      targetY = aboveY;
    } else if (!belowFits && !aboveFits) {
      const spaceBelow = globalThis.innerHeight - triggerRect.bottom -
        viewportPadding;
      const spaceAbove = triggerRect.top - viewportPadding;
      if (spaceAbove > spaceBelow) {
        sideY = "top";
        targetY = aboveY;
      }
    }

    const clampedX = Math.max(viewportPadding, Math.min(targetX, maxX));
    const clampedY = Math.max(viewportPadding, Math.min(targetY, maxY));

    popover.style.left = `${clampedX}px`;
    popover.style.top = `${clampedY}px`;
    popover.dataset.sideX = sideX;
    popover.dataset.sideY = sideY;
  });
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tabsBlock: {
      insertTabsBlock: () => ReturnType;
    };
  }
}

export const TabsPanel = Node.create({
  name: "tabsPanel",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      title: {
        default: "Tab",
        parseHTML: (element: HTMLElement) =>
          toTitle(element.getAttribute("data-title"), "Tab"),
        renderHTML: (attributes: { title?: string }) => ({
          "data-title": toTitle(attributes.title, "Tab"),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="tabsPanel"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "tabsPanel",
      }),
      0,
    ];
  },
});

export const TabsBlock = Node.create({
  name: "tabsBlock",
  group: "block",
  content: "tabsPanel+",
  defining: true,

  addAttributes() {
    return {
      activeIndex: {
        default: 0,
        parseHTML: (element: HTMLElement) => {
          const raw = Number.parseInt(
            element.getAttribute("data-active-index") ?? "0",
            10,
          );
          return Number.isFinite(raw) ? Math.max(0, raw) : 0;
        },
        renderHTML: (attributes: { activeIndex?: number }) => ({
          "data-active-index": Math.max(0, attributes.activeIndex ?? 0),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="tabsBlock"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "tabsBlock",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertTabsBlock: () => ({ chain, editor }) => {
        const panelA = editor.schema.nodes.tabsPanel.create(
          { title: "Overview" },
          editor.schema.nodes.paragraph.create(
            null,
            editor.schema.text("Overview content..."),
          ),
        );
        const panelB = editor.schema.nodes.tabsPanel.create(
          { title: "Details" },
          editor.schema.nodes.paragraph.create(
            null,
            editor.schema.text("Details content..."),
          ),
        );

        const tabs = editor.schema.nodes.tabsBlock.create(
          { activeIndex: 0 },
          [panelA, panelB],
        );

        return chain().focus().insertContent(tabs).run();
      },
    };
  },

  addNodeView() {
    return ({ editor, node, getPos }) => {
      let currentNode = node;
      const root = document.createElement("div");
      const shell = document.createElement("div");
      const header = document.createElement("div");
      const list = document.createElement("div");
      const actionPopover = document.createElement("div");
      const actionPopoverTitle = document.createElement("p");
      const renameInput = document.createElement("input");
      const actionPopoverButtons = document.createElement("div");
      const renameButton = document.createElement("button");
      const insertLeftButton = document.createElement("button");
      const insertRightButton = document.createElement("button");
      const deleteButton = document.createElement("button");
      const content = document.createElement("div");
      let actionIndex: number | null = null;

      root.className = "tabs-block";
      shell.className = "tabs-shell";
      header.className = "tabs-header";
      header.contentEditable = "false";
      list.className = "tabs-list";
      list.contentEditable = "false";
      content.className = "tabs-content";

      actionPopover.className = "tabs-action-popover editor-inline-popover";
      actionPopover.setAttribute("popover", "auto");
      actionPopover.dataset.open = "false";
      actionPopover.contentEditable = "false";
      actionPopoverButtons.className = "tabs-action-popover-buttons";
      actionPopoverTitle.className = "editor-inline-popover-title";
      actionPopoverTitle.textContent = "Tab actions";

      renameInput.type = "text";
      renameInput.className = "editor-inline-popover-input";
      renameInput.placeholder = "Tab name";
      renameInput.contentEditable = "false";

      renameButton.type = "button";
      renameButton.className =
        "editor-inline-popover-btn tabs-action-popover-btn";
      renameButton.textContent = "Rename tab";
      renameButton.contentEditable = "false";

      insertLeftButton.type = "button";
      insertLeftButton.className =
        "editor-inline-popover-btn tabs-action-popover-btn";
      insertLeftButton.textContent = "Insert tab to left";
      insertLeftButton.contentEditable = "false";

      insertRightButton.type = "button";
      insertRightButton.className =
        "editor-inline-popover-btn tabs-action-popover-btn";
      insertRightButton.textContent = "Insert tab to right";
      insertRightButton.contentEditable = "false";

      deleteButton.type = "button";
      deleteButton.className =
        "editor-inline-popover-btn tabs-action-popover-btn tabs-action-popover-btn-danger";
      deleteButton.textContent = "Delete tab";
      deleteButton.contentEditable = "false";

      actionPopoverButtons.append(
        renameButton,
        insertLeftButton,
        insertRightButton,
        deleteButton,
      );
      actionPopover.append(
        actionPopoverTitle,
        renameInput,
        actionPopoverButtons,
      );

      header.append(list);
      shell.append(header, content);
      root.append(shell, actionPopover);

      const getPanels = (sourceNode = currentNode): PanelMeta[] => {
        const panels: PanelMeta[] = [];
        let offset = 0;
        let index = 0;

        sourceNode.forEach((child) => {
          const title = toTitle(child.attrs.title, `Tab ${index + 1}`);
          panels.push({ index, title, offset, nodeSize: child.nodeSize });
          offset += child.nodeSize;
          index += 1;
        });

        return panels;
      };

      const getParentPos = (): number | null => {
        if (typeof getPos !== "function") {
          return null;
        }
        const pos = getPos();
        return typeof pos === "number" ? pos : null;
      };

      const setActive = (index: number): void => {
        if (!editor.isEditable) {
          return;
        }
        closeActionPopover();
        const parentPos = getParentPos();
        if (parentPos === null) {
          return;
        }
        const panels = getPanels();
        const next = normalizeIndex(index, panels.length);
        const currentActive = normalizeIndex(
          currentNode.attrs.activeIndex ?? 0,
          panels.length,
        );
        if (next === currentActive) {
          return;
        }
        const attrs = { ...currentNode.attrs, activeIndex: next };
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(parentPos, undefined, attrs),
        );
      };

      const closeActionPopover = (): void => {
        actionIndex = null;
        actionPopover.dataset.open = "false";
        if (actionPopover.matches(":popover-open")) {
          try {
            actionPopover.hidePopover();
          } catch {
            // Ignore if it closes before hide runs.
          }
        }
      };

      const openActionPopover = (index: number, anchor: HTMLElement): void => {
        if (!editor.isEditable) {
          return;
        }
        const panels = getPanels();
        const panel = panels[index];
        if (!panel) {
          return;
        }
        actionIndex = index;
        actionPopover.dataset.open = "true";
        actionPopoverTitle.textContent = panel.title;
        renameInput.value = panel.title;
        deleteButton.disabled = panels.length <= 1;
        showPopoverCompat(actionPopover, anchor);
        positionPopover(anchor, actionPopover);
        requestAnimationFrame(() => {
          renameInput.focus();
          renameInput.select();
        });
      };

      const renamePanel = (): void => {
        if (!editor.isEditable) {
          return;
        }
        const index = actionIndex;
        if (typeof index !== "number") {
          return;
        }

        const panels = getPanels();
        const panel = panels[index];
        const parentPos = getParentPos();
        if (!panel || parentPos === null) {
          closeActionPopover();
          return;
        }

        const panelPos = parentPos + 1 + panel.offset;
        const panelNode = currentNode.child(panel.index);
        const attrs = {
          ...panelNode.attrs,
          title: toTitle(renameInput.value, panel.title),
        };
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(panelPos, undefined, attrs),
        );
        closeActionPopover();
      };

      const insertPanelAt = (index: number): void => {
        if (!editor.isEditable) {
          return;
        }
        closeActionPopover();
        const parentPos = getParentPos();
        if (parentPos === null) {
          return;
        }

        const panels = getPanels();
        const insertIndex = Math.max(0, Math.min(index, panels.length));
        const nextNumber = panels.length + 1;
        const panel = editor.schema.nodes.tabsPanel.create(
          { title: `Tab ${nextNumber}` },
          editor.schema.nodes.paragraph.create(
            null,
            editor.schema.text(`Tab ${nextNumber} content...`),
          ),
        );

        const insertOffset = insertIndex === panels.length
          ? currentNode.content.size
          : (panels[insertIndex]?.offset ?? currentNode.content.size);
        const insertPos = parentPos + 1 + insertOffset;
        let tr = editor.state.tr.insert(insertPos, panel);
        tr = tr.setNodeMarkup(parentPos, undefined, {
          ...currentNode.attrs,
          activeIndex: insertIndex,
        });
        editor.view.dispatch(tr);
      };

      const removePanelAt = (index: number): void => {
        if (!editor.isEditable) {
          return;
        }
        closeActionPopover();
        const panels = getPanels();
        if (panels.length <= 1) {
          return;
        }
        const parentPos = getParentPos();
        if (parentPos === null) {
          return;
        }

        const target = normalizeIndex(index, panels.length);
        const panel = panels[target];
        const active = normalizeIndex(
          currentNode.attrs.activeIndex ?? 0,
          panels.length,
        );
        const from = parentPos + 1 + panel.offset;
        const to = from + panel.nodeSize;
        let nextActive = active;

        if (active === target) {
          nextActive = normalizeIndex(target - 1, panels.length - 1);
        } else if (active > target) {
          nextActive = active - 1;
        }

        let tr = editor.state.tr.delete(from, to);
        tr = tr.setNodeMarkup(parentPos, undefined, {
          ...currentNode.attrs,
          activeIndex: nextActive,
        });
        editor.view.dispatch(tr);
      };

      const updatePanelVisibility = (): void => {
        const active = normalizeIndex(
          currentNode.attrs.activeIndex ?? 0,
          currentNode.childCount,
        );

        const panelElements = Array.from(content.children).filter(
          (child): child is HTMLElement =>
            child instanceof HTMLElement && child.dataset.type === "tabsPanel",
        );

        panelElements.forEach((panelElement, index) => {
          const visible = index === active;
          panelElement.style.display = visible ? "" : "none";
          panelElement.setAttribute("aria-hidden", visible ? "false" : "true");
        });
      };

      const renderHeader = (): void => {
        const panels = getPanels();
        const active = normalizeIndex(
          currentNode.attrs.activeIndex ?? 0,
          panels.length,
        );

        list.textContent = "";
        panels.forEach((panel) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "tabs-tab-btn";
          button.textContent = panel.title;
          button.dataset.tabIndex = String(panel.index);
          button.dataset.active = panel.index === active ? "true" : "false";
          button.contentEditable = "false";
          button.addEventListener("click", () => setActive(panel.index));
          button.addEventListener("dblclick", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const currentButton = list.querySelector(
              `[data-tab-index="${panel.index}"]`,
            );
            if (currentButton instanceof HTMLElement) {
              openActionPopover(panel.index, currentButton);
              return;
            }
            openActionPopover(panel.index, button);
          });
          list.append(button);
        });
      };

      insertLeftButton.addEventListener("click", () => {
        if (typeof actionIndex !== "number") {
          return;
        }
        insertPanelAt(actionIndex);
      });
      renameButton.addEventListener("click", renamePanel);
      insertRightButton.addEventListener("click", () => {
        if (typeof actionIndex !== "number") {
          return;
        }
        insertPanelAt(actionIndex + 1);
      });
      deleteButton.addEventListener("click", () => {
        if (typeof actionIndex !== "number") {
          return;
        }
        removePanelAt(actionIndex);
      });
      actionPopover.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeActionPopover();
        }
      });
      renameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          renamePanel();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeActionPopover();
        }
      });

      const onPopoverToggle = () => {
        const open = actionPopover.matches(":popover-open");
        actionPopover.dataset.open = open ? "true" : "false";
        if (!open) {
          actionIndex = null;
        }
      };

      actionPopover.addEventListener("toggle", onPopoverToggle);

      renderHeader();
      requestAnimationFrame(() => updatePanelVisibility());

      return {
        dom: root,
        contentDOM: content,
        stopEvent: (event) => {
          const target = event.target;

          return target instanceof globalThis.Node &&
            (header.contains(target) || actionPopover.contains(target));
        },
        ignoreMutation: (mutation) => {
          const target = mutation.target;

          return target instanceof globalThis.Node &&
            (header.contains(target) || actionPopover.contains(target));
        },
        update: (nextNode) => {
          if (nextNode.type !== currentNode.type) {
            return false;
          }

          currentNode = nextNode;
          if (
            typeof actionIndex === "number" &&
            actionIndex >= currentNode.childCount
          ) {
            closeActionPopover();
          }
          renderHeader();
          updatePanelVisibility();
          return true;
        },
        destroy: () => {
          actionPopover.removeEventListener("toggle", onPopoverToggle);
        },
      };
    };
  },
});
