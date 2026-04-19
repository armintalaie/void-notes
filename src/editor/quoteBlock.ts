import { getRenderedAttributes, mergeAttributes, Node } from "@tiptap/core";
import type { DOMOutputSpec, Node as ProseMirrorNode } from "@tiptap/pm/model";

type QuoteFooterAttrs = {
  value?: string | null;
  href?: string | null;
};

type QuoteFooterState = {
  value: string | null;
  href: string | null;
};

function normalizeFooterValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeFooterHref(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function findDirectFooter(element: HTMLElement): HTMLElement | null {
  for (const child of Array.from(element.children)) {
    if (
      child instanceof HTMLElement && child.tagName.toLowerCase() === "footer"
    ) {
      return child;
    }
  }

  return null;
}

function getFooterState(attrs: QuoteFooterAttrs): QuoteFooterState {
  const href = normalizeFooterHref(attrs.href);
  const value = normalizeFooterValue(attrs.value) ?? href;

  return {
    value,
    href,
  };
}

function createTriggerIcon(hasContext: boolean): SVGSVGElement {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("quote-block-footer-trigger-icon");

  const paths = hasContext
    ? [
      "M12 20h9",
      "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z",
    ]
    : [
      "M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z",
      "M6.2 19.8C7 17.1 9.1 15 12 14.2",
      "M17 8V5",
      "M15.5 6.5h3",
      "M17 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
      "M15.2 18.8c.6-.9 1.6-1.4 2.8-1.4s2.2.5 2.8 1.4",
    ];

  paths.forEach((definition) => {
    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("d", definition);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-width", "1.8");
    svg.append(path);
  });

  return svg;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    quoteBlock: {
      setQuoteFooter: (value: QuoteFooterAttrs) => ReturnType;
      clearQuoteFooter: () => ReturnType;
    };
  }
}

export const QuoteBlock = Node.create({
  name: "blockquote",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      value: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const attributeValue = normalizeFooterValue(
            element.getAttribute("data-quote-footer-value"),
          );
          if (attributeValue) {
            return attributeValue;
          }

          const footerElement = findDirectFooter(element);
          if (!footerElement) {
            return null;
          }

          const footerAnchor = footerElement.querySelector("a");
          const footerText = normalizeFooterValue(
            footerAnchor?.textContent ?? footerElement.textContent,
          );

          return footerText;
        },
        renderHTML: (attributes: QuoteFooterAttrs) => ({
          "data-quote-footer-value": normalizeFooterValue(attributes.value),
        }),
      },
      href: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const attributeHref = normalizeFooterHref(
            element.getAttribute("data-quote-footer-href"),
          );
          if (attributeHref) {
            return attributeHref;
          }

          const footerElement = findDirectFooter(element);
          if (!footerElement) {
            return null;
          }

          const anchor = footerElement.querySelector("a");
          return normalizeFooterHref(anchor?.getAttribute("href"));
        },
        renderHTML: (attributes: QuoteFooterAttrs) => ({
          "data-quote-footer-href": normalizeFooterHref(attributes.href),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "blockquote" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const footerState = getFooterState({
      value: node.attrs.value,
      href: node.attrs.href,
    });

    const quoteAttributes: Record<string, string> = {
      "data-type": "quoteBlock",
    };

    if (footerState.value) {
      quoteAttributes["data-quote-footer-value"] = footerState.value;
    }

    if (footerState.href) {
      quoteAttributes["data-quote-footer-href"] = footerState.href;
    }

    const children: DOMOutputSpec[] = [
      ["div", { "data-quote-content": "" }, 0],
    ];

    if (footerState.value || footerState.href) {
      if (footerState.href) {
        children.push([
          "footer",
          { "data-quote-footer": "", "data-quote-footer-kind": "link" },
          [
            "a",
            {
              href: footerState.href,
              target: "_blank",
              rel: "noopener noreferrer",
            },
            footerState.value ?? footerState.href,
          ],
        ]);
      } else {
        children.push([
          "footer",
          { "data-quote-footer": "", "data-quote-footer-kind": "text" },
          footerState.value,
        ]);
      }
    }

    return [
      "blockquote",
      mergeAttributes(HTMLAttributes, quoteAttributes),
      ...children,
    ];
  },

  addCommands() {
    return {
      setQuoteFooter: (value) => ({ commands }) => {
        const normalized = getFooterState(value);
        return commands.updateAttributes(this.name, {
          value: normalized.value,
          href: normalized.href,
        });
      },
      clearQuoteFooter: () => ({ commands }) => {
        return commands.updateAttributes(this.name, {
          value: null,
          href: null,
        });
      },
    };
  },

  addNodeView() {
    return ({ editor, node, getPos, HTMLAttributes }) => {
      const root = document.createElement("blockquote");
      const content = document.createElement("div");
      const footer = document.createElement("footer");
      const footerDisplay = document.createElement("span");
      const triggerButton = document.createElement("button");
      const panel = document.createElement("div");
      const panelTitle = document.createElement("p");
      const valueInput = document.createElement("input");
      const hrefInput = document.createElement("input");
      const actions = document.createElement("div");
      const saveButton = document.createElement("button");
      const clearButton = document.createElement("button");
      const closeButton = document.createElement("button");
      let activeNode = node;
      let menuOpen = false;
      let draftValue: string | null = null;
      let draftHref: string | null = null;

      content.dataset.quoteContent = "";
      content.className = "quote-block-content";

      footer.className = "quote-block-footer";
      footer.dataset.quoteFooter = "";
      footer.contentEditable = "false";

      footerDisplay.className = "quote-block-footer-display";
      footerDisplay.contentEditable = "false";

      triggerButton.type = "button";
      triggerButton.className = "quote-block-footer-trigger";
      triggerButton.contentEditable = "false";

      panel.className = "quote-block-panel editor-inline-popover";
      panel.dataset.open = "false";
      panel.contentEditable = "false";

      panelTitle.className = "editor-inline-popover-title";
      panelTitle.textContent = "Quote context";
      panelTitle.contentEditable = "false";

      valueInput.type = "text";
      valueInput.className = "editor-inline-popover-input";
      valueInput.placeholder = "Source text or link label";
      valueInput.contentEditable = "false";

      hrefInput.type = "url";
      hrefInput.className = "editor-inline-popover-input";
      hrefInput.placeholder = "https://example.com (optional)";
      hrefInput.contentEditable = "false";

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

      closeButton.type = "button";
      closeButton.className = "editor-inline-popover-btn";
      closeButton.textContent = "Close";
      closeButton.contentEditable = "false";

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
        valueInput.focus();
        valueInput.select();
      };

      const applyNodeAttrs = (nextState: QuoteFooterState) => {
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
              value: nextState.value,
              href: nextState.href,
            });

            return true;
          })
          .run();
      };

      const syncDraftFromInputs = () => {
        draftValue = normalizeFooterValue(valueInput.value);
        draftHref = normalizeFooterHref(hrefInput.value);
      };

      const syncUI = (updatedNode: ProseMirrorNode) => {
        activeNode = updatedNode;
        const footerState = getFooterState({
          value: updatedNode.attrs.value,
          href: updatedNode.attrs.href,
        });

        footerDisplay.replaceChildren();

        if (footerState.href) {
          const anchor = document.createElement("a");
          anchor.href = footerState.href;
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
          anchor.textContent = footerState.value ?? footerState.href;
          anchor.className = "quote-block-footer-link";
          anchor.contentEditable = "false";
          footerDisplay.append(anchor);
          footer.dataset.quoteFooterKind = "link";
        } else if (footerState.value) {
          const text = document.createElement("span");
          text.textContent = footerState.value;
          text.className = "quote-block-footer-text";
          text.contentEditable = "false";
          footerDisplay.append(text);
          footer.dataset.quoteFooterKind = "text";
        } else {
          delete footer.dataset.quoteFooterKind;
        }

        const hasContext = Boolean(footerState.value || footerState.href);
        root.dataset.hasFooter = String(hasContext);

        triggerButton.hidden = !editor.isEditable;
        triggerButton.replaceChildren(createTriggerIcon(hasContext));
        triggerButton.dataset.state = hasContext ? "configured" : "empty";
        triggerButton.setAttribute(
          "aria-label",
          hasContext ? "Edit quote context" : "Add quote context",
        );
        triggerButton.title = hasContext
          ? "Edit quote context"
          : "Add quote context";

        valueInput.value = footerState.value ?? "";
        hrefInput.value = footerState.href ?? "";
        draftValue = footerState.value;
        draftHref = footerState.href;

        footer.hidden = !editor.isEditable && !hasContext;
      };

      triggerButton.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (menuOpen) {
          closeMenu();
          return;
        }

        const currentState = getFooterState({
          value: activeNode.attrs.value,
          href: activeNode.attrs.href,
        });
        valueInput.value = currentState.value ?? "";
        hrefInput.value = currentState.href ?? "";
        draftValue = currentState.value;
        draftHref = currentState.href;
        openMenu();
      });

      valueInput.addEventListener("input", syncDraftFromInputs);
      valueInput.addEventListener("change", syncDraftFromInputs);
      hrefInput.addEventListener("input", syncDraftFromInputs);
      hrefInput.addEventListener("change", syncDraftFromInputs);

      saveButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        syncDraftFromInputs();

        applyNodeAttrs({
          value: draftValue,
          href: draftHref,
        });
        closeMenu();
      });

      clearButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        applyNodeAttrs({ value: null, href: null });
        closeMenu();
      });

      closeButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
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

      root.classList.add("quote-block");

      actions.append(saveButton, clearButton, closeButton);
      panel.append(panelTitle, valueInput, hrefInput, actions);
      footer.append(footerDisplay, triggerButton, panel);
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

          root.classList.add("quote-block");
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
