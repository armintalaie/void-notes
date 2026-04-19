import { Drawer } from "@base-ui/react/drawer";
import { mergeAttributes, Node } from "@tiptap/core";
import {
  DOMSerializer,
  Fragment,
  type Node as ProseMirrorNode,
} from "@tiptap/pm/model";
import {
  NodeViewContent,
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TbFileText } from "react-icons/tb";

const DEFAULT_PREVIEW = "Nested page";
const NESTED_PAGE_OPEN_EVENT = "nested-page-open";
let activeNestedPageId: string | null = null;

type NestedPageOpenDetail = {
  pageId?: unknown;
};

function toText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value;
}

function normalizePageId(value: unknown): string {
  const parsed = toText(value).trim();
  return parsed.length > 0 ? parsed : "";
}

function createPageId(): string {
  if (
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ) {
    return `nested-${crypto.randomUUID()}`;
  }

  return `nested-${Date.now().toString(36)}-${
    Math.random().toString(36).slice(2, 8)
  }`;
}

function findFirstPreviewNode(node: ProseMirrorNode): ProseMirrorNode | null {
  if (node.isTextblock) {
    const text = node.textBetween(0, node.content.size, "\n", "\n").trim();
    if (text.length > 0) {
      return node;
    }
  }

  let found: ProseMirrorNode | null = null;
  node.forEach((child) => {
    if (found) {
      return;
    }
    found = findFirstPreviewNode(child);
  });

  return found;
}

function getNodePreviewHtml(node: ProseMirrorNode): string {
  const previewNode = findFirstPreviewNode(node);
  if (!previewNode) {
    return DEFAULT_PREVIEW;
  }

  const serializer = DOMSerializer.fromSchema(previewNode.type.schema);
  const wrapper = document.createElement("div");
  const fragment = serializer.serializeFragment(
    Fragment.from(previewNode),
    { document },
  );
  wrapper.append(fragment);

  return wrapper.innerHTML || DEFAULT_PREVIEW;
}

function NestedPageNodeView({ node, updateAttributes }: NodeViewProps) {
  const drawerActionsRef = useRef<Drawer.Root.Actions | null>(null);
  const fallbackPageIdRef = useRef(createPageId());
  const previewRef = useRef<HTMLSpanElement | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const [iconSizePx, setIconSizePx] = useState(14);
  const pageIdFromAttrs = normalizePageId(node.attrs.pageId);
  const pageId = pageIdFromAttrs.length > 0
    ? pageIdFromAttrs
    : fallbackPageIdRef.current;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pageIdFromAttrs.length > 0) {
      return;
    }

    updateAttributes({ pageId });
  }, [pageId, pageIdFromAttrs, updateAttributes]);

  useEffect(() => {
    if (activeNestedPageId === pageId) {
      setOpen(true);
    }
  }, [pageId]);

  const closeSheet = useCallback(() => {
    setOpen(false);
    if (activeNestedPageId === pageId) {
      activeNestedPageId = null;
    }
  }, [pageId]);

  const openSheet = useCallback(() => {
    activeNestedPageId = pageId;
    globalThis.dispatchEvent(
      new CustomEvent<NestedPageOpenDetail>(NESTED_PAGE_OPEN_EVENT, {
        detail: { pageId },
      }),
    );
    setOpen(true);
  }, [pageId]);

  useEffect(() => {
    const onOpenEvent = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      const openedPageId = normalizePageId(
        (event.detail as NestedPageOpenDetail | null)?.pageId,
      );
      if (openedPageId.length === 0) {
        return;
      }

      if (openedPageId === pageId) {
        setOpen(true);
        activeNestedPageId = pageId;
        return;
      }

      closeSheet();
    };

    globalThis.addEventListener(NESTED_PAGE_OPEN_EVENT, onOpenEvent);

    return () => {
      globalThis.removeEventListener(NESTED_PAGE_OPEN_EVENT, onOpenEvent);
    };
  }, [closeSheet, pageId]);

  const handleDrawerOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      activeNestedPageId = pageId;
      setOpen(true);
      return;
    }

    closeSheet();
  }, [closeSheet, pageId]);

  const previewHtml = useMemo(() => getNodePreviewHtml(node), [node]);

  useEffect(() => {
    const previewElement = previewRef.current;
    if (!previewElement) {
      return;
    }

    const syncIconSize = () => {
      const target = previewElement.firstElementChild instanceof HTMLElement
        ? previewElement.firstElementChild
        : previewElement;
      const parsedFontSize = Number.parseFloat(
        globalThis.getComputedStyle(target).fontSize,
      );
      if (!Number.isFinite(parsedFontSize) || parsedFontSize <= 0) {
        return;
      }
      setIconSizePx(parsedFontSize);
    };

    syncIconSize();

    globalThis.addEventListener("resize", syncIconSize);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        globalThis.removeEventListener("resize", syncIconSize);
      };
    }

    const observer = new ResizeObserver(syncIconSize);
    observer.observe(previewElement);
    if (previewElement.firstElementChild instanceof HTMLElement) {
      observer.observe(previewElement.firstElementChild);
    }

    return () => {
      globalThis.removeEventListener("resize", syncIconSize);
      observer.disconnect();
    };
  }, [previewHtml]);

  return (
    <NodeViewWrapper
      ref={setPortalContainer}
      className="nested-page-node"
      data-type="nestedPage"
      data-page-id={pageId}
    >
      <Drawer.Root
        open={open}
        onOpenChange={handleDrawerOpenChange}
        modal={false}
        actionsRef={drawerActionsRef}
      >
        <button
          type="button"
          className="nested-page-trigger"
          contentEditable={false}
          data-nested-page-trigger="true"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openSheet();
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openSheet();
          }}
        >
          <span
            className="nested-page-icon"
            contentEditable={false}
            aria-hidden="true"
            style={{
              width: `${iconSizePx}px`,
              height: `${iconSizePx}px`,
              fontSize: `${iconSizePx}px`,
            }}
          >
            <TbFileText size="1em" strokeWidth={1.85} />
          </span>
          <span
            ref={previewRef}
            className="nested-page-preview"
            contentEditable={false}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          <span
            className="nested-page-chevron"
            contentEditable={false}
            aria-hidden="true"
          >
            {"\u203a"}
          </span>
        </button>

        {portalContainer
          ? (
            <Drawer.Portal keepMounted container={portalContainer}>
              <Drawer.Popup
                className="nested-page-sheet-popup"
                aria-label="Nested page"
              >
                <div
                  className="nested-page-sheet-header"
                  contentEditable={false}
                >
                  <Drawer.Close
                    className="nested-page-sheet-close"
                    aria-label="Close nested page"
                  >
                    X
                  </Drawer.Close>
                </div>
                <div className="nested-page-sheet-body note-editor-shell">
                  <NodeViewContent className="note-editor nested-page-editor" />
                </div>
              </Drawer.Popup>
            </Drawer.Portal>
          )
          : null}
      </Drawer.Root>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    nestedPage: {
      insertNestedPage: () => ReturnType;
    };
  }
}

export const NestedPage = Node.create({
  name: "nestedPage",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      pageId: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          normalizePageId(element.getAttribute("data-page-id")),
        renderHTML: (attributes: { pageId?: string }) => ({
          "data-page-id": normalizePageId(attributes.pageId),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="nestedPage"]',
        contentElement: (element: HTMLElement) =>
          element.querySelector(":scope > .nested-page-hidden-content") ??
            element,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const pageId = normalizePageId(node.attrs.pageId);

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "nestedPage",
        "data-page-id": pageId,
        class: "nested-page-node",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertNestedPage: () => ({ chain, editor }) => {
        const pageId = createPageId();
        const paragraph = editor.schema.nodes.paragraph.create();

        const nestedPage = editor.schema.nodes.nestedPage.create(
          { pageId },
          [paragraph],
        );

        return chain().focus().insertContent(nestedPage).run();
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(NestedPageNodeView);
  },
});
