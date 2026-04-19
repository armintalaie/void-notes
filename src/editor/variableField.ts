import { mergeAttributes, Node } from "@tiptap/core";

type VariableFieldAttrs = {
  variableId?: string;
  variableLabel?: string;
  displayValue?: string;
  variableState?: "unset" | "placeholder" | "set" | string;
  unset?: boolean | string;
};

function toText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value;
}

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return value === "true";
}

function toState(value: unknown): "unset" | "placeholder" | "set" {
  if (value === "set" || value === "placeholder" || value === "unset") {
    return value;
  }

  return "unset";
}

function getDisplayValue(attrs: VariableFieldAttrs): string {
  const displayValue = toText(attrs.displayValue).trim();
  const label = toText(attrs.variableLabel).trim();
  const fallback = label.length > 0 ? label : "Variable";
  return displayValue.length > 0 ? displayValue : fallback;
}

export const VariableField = Node.create({
  name: "variableField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      variableId: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          toText(element.getAttribute("data-variable-id")),
        renderHTML: (attributes: VariableFieldAttrs) => ({
          "data-variable-id": toText(attributes.variableId),
        }),
      },
      variableLabel: {
        default: "Variable",
        parseHTML: (element: HTMLElement) =>
          toText(element.getAttribute("data-variable-label")) || "Variable",
        renderHTML: (attributes: VariableFieldAttrs) => ({
          "data-variable-label": toText(attributes.variableLabel) || "Variable",
        }),
      },
      displayValue: {
        default: "",
        parseHTML: (element: HTMLElement) => {
          const attributeValue = toText(
            element.getAttribute("data-display-value"),
          );
          return attributeValue.length > 0
            ? attributeValue
            : element.textContent ?? "";
        },
        renderHTML: (attributes: VariableFieldAttrs) => ({
          "data-display-value": getDisplayValue(attributes),
        }),
      },
      variableState: {
        default: "unset",
        parseHTML: (element: HTMLElement) => {
          const parsed = toState(element.getAttribute("data-variable-state"));
          if (parsed !== "unset") {
            return parsed;
          }

          // Backwards compatibility for older content that only stores `data-unset`.
          return toBool(element.getAttribute("data-unset")) ? "unset" : "set";
        },
        renderHTML: (attributes: VariableFieldAttrs) => ({
          "data-variable-state": toState(attributes.variableState),
        }),
      },
      unset: {
        default: false,
        parseHTML: (element: HTMLElement) =>
          toBool(element.getAttribute("data-unset")),
        renderHTML: (attributes: VariableFieldAttrs) => ({
          "data-unset": toBool(attributes.unset) ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="variableField"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as VariableFieldAttrs;

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "variableField",
        class: "note-variable-field",
        contenteditable: "false",
        "data-variable-state": toState(attrs.variableState),
      }),
      getDisplayValue(attrs),
    ];
  },

  renderText({ node }) {
    return getDisplayValue(node.attrs as VariableFieldAttrs);
  },
});
