import { mergeAttributes, Node } from "@tiptap/core";

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: "info",
        parseHTML: (element) => element.getAttribute("data-callout") ?? "info",
        renderHTML: (attributes) => ({ "data-callout": attributes.tone }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes), 0];
  },
});
