import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";

const SVG_NS = "http://www.w3.org/2000/svg";

type ToolbarIcon = "copy" | "check" | "x";

function createToolbarIcon(kind: ToolbarIcon): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.9");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  if (kind === "copy") {
    const back = document.createElementNS(SVG_NS, "rect");
    back.setAttribute("x", "8");
    back.setAttribute("y", "8");
    back.setAttribute("width", "11");
    back.setAttribute("height", "11");
    back.setAttribute("rx", "2");
    back.setAttribute("ry", "2");

    const frontPath = document.createElementNS(SVG_NS, "path");
    frontPath.setAttribute(
      "d",
      "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
    );

    svg.append(back, frontPath);
    return svg;
  }

  if (kind === "check") {
    const check = document.createElementNS(SVG_NS, "polyline");
    check.setAttribute("points", "5 13 10 18 19 7");
    svg.append(check);
    return svg;
  }

  const lineA = document.createElementNS(SVG_NS, "line");
  lineA.setAttribute("x1", "6");
  lineA.setAttribute("y1", "6");
  lineA.setAttribute("x2", "18");
  lineA.setAttribute("y2", "18");

  const lineB = document.createElementNS(SVG_NS, "line");
  lineB.setAttribute("x1", "18");
  lineB.setAttribute("y1", "6");
  lineB.setAttribute("x2", "6");
  lineB.setAttribute("y2", "18");

  svg.append(lineA, lineB);
  return svg;
}

function setCopyButtonIcon(button: HTMLButtonElement, icon: ToolbarIcon): void {
  button.replaceChildren(createToolbarIcon(icon));
}

const codeLanguages = [
  { value: "plaintext", label: "Plain text" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "css", label: "CSS" },
  { value: "html", label: "HTML" },
  { value: "bash", label: "Bash" },
] as const;

const languageAliases: Record<string, string> = {
  text: "plaintext",
  plain: "plaintext",
  plaintext: "plaintext",
  txt: "plaintext",
  ts: "typescript",
  typescript: "typescript",
  js: "javascript",
  javascript: "javascript",
  java: "java",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  py: "python",
  python: "python",
  css: "css",
  html: "html",
};

const languageSet = new Set<string>(
  codeLanguages.map((language) => language.value),
);

function normalizeLanguage(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const normalized = languageAliases[value.trim().toLowerCase()] ??
    value.trim().toLowerCase();
  return languageSet.has(normalized) ? normalized : null;
}

export const CodeBlockWithTools = CodeBlockLowlight.extend({
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const wrapper = document.createElement("div");
      const toolbar = document.createElement("div");
      const languageSelect = document.createElement("select");
      const copyButton = document.createElement("button");
      const pre = document.createElement("pre");
      const code = document.createElement("code");

      let copyTimer: number | undefined;

      wrapper.className = "code-block-shell";
      toolbar.className = "code-block-toolbar";
      languageSelect.className = "code-block-language";
      copyButton.className = "code-block-copy";
      copyButton.type = "button";
      copyButton.ariaLabel = "Copy code";
      setCopyButtonIcon(copyButton, "copy");
      pre.className = "code-block-body";

      for (const option of codeLanguages) {
        const element = document.createElement("option");
        element.value = option.value;
        element.textContent = option.label;
        languageSelect.append(element);
      }

      const syncLanguageUI = (language: string | null | undefined) => {
        const next = normalizeLanguage(language) ?? "plaintext";
        languageSelect.value = next;
        code.className = `hljs language-${next}`;
      };

      const setLanguage = (language: string) => {
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
              language: normalizeLanguage(language),
            });

            return true;
          })
          .run();
      };

      const handleLanguageChange = () => {
        setLanguage(languageSelect.value);
      };

      const handleCopyClick = async () => {
        try {
          await navigator.clipboard.writeText(code.textContent ?? "");
          setCopyButtonIcon(copyButton, "check");
          copyButton.ariaLabel = "Copied";

          if (copyTimer) {
            globalThis.clearTimeout(copyTimer);
          }

          copyTimer = globalThis.setTimeout(() => {
            setCopyButtonIcon(copyButton, "copy");
            copyButton.ariaLabel = "Copy code";
          }, 1200);
        } catch {
          setCopyButtonIcon(copyButton, "x");
          copyButton.ariaLabel = "Copy failed";

          if (copyTimer) {
            globalThis.clearTimeout(copyTimer);
          }

          copyTimer = globalThis.setTimeout(() => {
            setCopyButtonIcon(copyButton, "copy");
            copyButton.ariaLabel = "Copy code";
          }, 1200);
        }
      };

      languageSelect.addEventListener("change", handleLanguageChange);
      copyButton.addEventListener("click", handleCopyClick);

      syncLanguageUI(node.attrs.language);

      pre.append(code);
      toolbar.append(languageSelect, copyButton);
      wrapper.append(toolbar, pre);

      return {
        dom: wrapper,
        contentDOM: code,
        stopEvent: (event) => {
          const target = event.target;

          return target instanceof globalThis.Node && toolbar.contains(target);
        },
        ignoreMutation: (mutation) => {
          const target = mutation.target;

          return target instanceof Element && toolbar.contains(target);
        },
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }

          syncLanguageUI(updatedNode.attrs.language);
          return true;
        },
        destroy: () => {
          languageSelect.removeEventListener("change", handleLanguageChange);
          copyButton.removeEventListener("click", handleCopyClick);

          if (copyTimer) {
            globalThis.clearTimeout(copyTimer);
          }
        },
      };
    };
  },
});
