import { Menu } from "@base-ui/react/menu";
import { Drawer } from "@base-ui/react/drawer";
import { Dialog } from "@base-ui/react/dialog";
import { Switch } from "@base-ui/react/switch";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import type { JSONContent } from "@tiptap/core";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import html from "highlight.js/lib/languages/xml";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import type { IconType } from "react-icons";
import {
  TbAlertCircle,
  TbBlockquote,
  TbBold,
  TbCalendarDue,
  TbCircle,
  TbCircleCheck,
  TbCircleHalf2,
  TbCircleOff,
  TbCode,
  TbColumns2,
  TbCopy,
  TbDownload,
  TbFileCode,
  TbFileText,
  TbH1,
  TbH2,
  TbH3,
  TbHeading,
  TbItalic,
  TbLink,
  TbList,
  TbListCheck,
  TbMarkdown,
  TbSettings,
  TbShare2,
  TbStrikethrough,
  TbTable,
  TbUnderline,
  TbVariable,
  TbVariableOff,
  TbVariablePlus,
} from "react-icons/tb";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Callout } from "./callout.ts";
import { emptyNoteHtml, sampleNoteHtml } from "./sampleNote.ts";
import {
  CustomDropdown,
  type DropdownItem,
} from "../components/CustomDropdown.tsx";
import {
  StatusTaskItem,
  type StatusValue,
  statusValues,
} from "./statusTaskItem.ts";
import { CodeBlockWithTools } from "./codeBlockWithTools.ts";
import { DueDate } from "./dueDate.ts";
import { NestedPage } from "./nestedPage.tsx";
import { QuoteBlock } from "./quoteBlock.ts";
import { TabsBlock, TabsPanel } from "./tabsBlock.ts";
import { VariableField } from "./variableField.ts";
import type {
  AccentColor,
  AlertStrength,
  AlertTone,
  BgPalette,
  BodyFont,
  ElevationPack,
  FontScale,
  HeadingFont,
  Mode,
  Palette,
  RadiusPack,
} from "../themeControls.ts";

type NoteEditorProps = {
  initialContent?: JSONContent | string;
  onContentSnapshotChange?: (snapshot: NoteEditorSnapshot) => void;
  useSampleNote: boolean;
  onUseSampleNoteChange: (next: boolean) => void;
  mode: Mode;
  bgPalette: BgPalette;
  palette: Palette;
  accentColor: AccentColor;
  alertSuccessTone: AlertTone;
  alertSuccessStrength: AlertStrength;
  alertInfoTone: AlertTone;
  alertInfoStrength: AlertStrength;
  alertWarningTone: AlertTone;
  alertWarningStrength: AlertStrength;
  alertDangerTone: AlertTone;
  bodyFont: BodyFont;
  headingFont: HeadingFont;
  fontScale: FontScale;
  radius: RadiusPack;
  elevation: ElevationPack;
  onModeChange: (next: Mode) => void;
  onBgPaletteChange: (next: BgPalette) => void;
  onPaletteChange: (next: Palette) => void;
  onAccentColorChange: (next: AccentColor) => void;
  onAlertSuccessToneChange: (next: AlertTone) => void;
  onAlertSuccessStrengthChange: (next: AlertStrength) => void;
  onAlertInfoToneChange: (next: AlertTone) => void;
  onAlertInfoStrengthChange: (next: AlertStrength) => void;
  onAlertWarningToneChange: (next: AlertTone) => void;
  onAlertWarningStrengthChange: (next: AlertStrength) => void;
  onAlertDangerToneChange: (next: AlertTone) => void;
  onBodyFontChange: (next: BodyFont) => void;
  onHeadingFontChange: (next: HeadingFont) => void;
  onFontScaleChange: (next: FontScale) => void;
  onRadiusChange: (next: RadiusPack) => void;
  onElevationChange: (next: ElevationPack) => void;
  onResetAppearance: () => void;
};

export type NoteEditorSnapshot = {
  json: JSONContent;
  html: string;
  plainText: string;
};

type SlashCommand = {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  icon: IconType;
  run: (editor: NonNullable<ReturnType<typeof useEditor>>) => void;
};

type SlashMenuNode = {
  id: string;
  label: string;
  keywords: string;
  icon: IconType;
  commandId?: string;
  children?: SlashMenuNode[];
};

type IndexedSlashCommand = SlashCommand & {
  flatIndex: number;
};

type SlashContext = {
  query: string;
  from: number;
  to: number;
  left: number;
  top: number;
};

type VariableDefinition = {
  id: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  value: string;
};

type VariableResolution = {
  displayValue: string;
  state: "unset" | "placeholder" | "set";
};

type VariableValuePopover = {
  variableId: string;
  left: number;
  top: number;
  draftValue: string;
};

type SettingsSection = "general" | "appearance";
type CodeBlockSyntaxTheme =
  | "palette"
  | "github"
  | "github-dark"
  | "github-dark-dimmed"
  | "atom-one-light"
  | "atom-one-dark"
  | "stackoverflow-light"
  | "stackoverflow-dark"
  | "vs"
  | "vs2015"
  | "tokyo-night-dark"
  | "night-owl";
type SettingsNodeType =
  | "heading"
  | "table"
  | "callout"
  | "dueDate"
  | "tabsBlock"
  | "nestedPage"
  | "codeBlock"
  | "variableField";

type NodeVisibilitySetting = {
  enabled: boolean;
};

type NodeSettings = {
  heading: NodeVisibilitySetting;
  table: NodeVisibilitySetting & {
    headerBgColor: string;
  };
  callout: NodeVisibilitySetting & {
    backgroundColor: string;
    borderColor: string;
    fontColor: string;
  };
  dueDate: NodeVisibilitySetting;
  tabsBlock: NodeVisibilitySetting;
  nestedPage: NodeVisibilitySetting;
  codeBlock: NodeVisibilitySetting & {
    syntaxTheme: CodeBlockSyntaxTheme;
    backgroundColor: string;
    borderColor: string;
    toolbarBackgroundColor: string;
    toolbarBorderColor: string;
    textColor: string;
    controlBackgroundColor: string;
    controlTextColor: string;
  };
  variableField: NodeVisibilitySetting;
};

const seedVariableDefinitions: VariableDefinition[] = [
  {
    id: "client-name",
    label: "Client Name",
    placeholder: "Your name",
    defaultValue: "",
    value: "",
  },
  {
    id: "language",
    label: "Language",
    placeholder: "Preferred language",
    defaultValue: "English",
    value: "",
  },
  {
    id: "project-name",
    label: "Project Name",
    placeholder: "Program name",
    defaultValue: "Program Alpha",
    value: "",
  },
  {
    id: "account-manager",
    label: "Account Manager",
    placeholder: "Manager name",
    defaultValue: "",
    value: "Jordan Lee",
  },
  {
    id: "region",
    label: "Region",
    placeholder: "Operating region",
    defaultValue: "North America",
    value: "",
  },
  {
    id: "kickoff-date",
    label: "Kickoff Date",
    placeholder: "YYYY-MM-DD",
    defaultValue: "",
    value: "",
  },
  {
    id: "timezone",
    label: "Timezone",
    placeholder: "Timezone",
    defaultValue: "America/Toronto",
    value: "",
  },
  {
    id: "support-email",
    label: "Support Email",
    placeholder: "support@company.com",
    defaultValue: "help@acme.test",
    value: "",
  },
  {
    id: "proposal-version",
    label: "Proposal Version",
    placeholder: "vX.Y",
    defaultValue: "",
    value: "v3.2",
  },
  {
    id: "tone",
    label: "Template Tone",
    placeholder: "Friendly, direct, formal...",
    defaultValue: "Professional",
    value: "",
  },
  {
    id: "next-step",
    label: "Next Step",
    placeholder: "Define next action",
    defaultValue: "",
    value: "",
  },
  {
    id: "legal-approver",
    label: "Legal Approver",
    placeholder: "Approver name",
    defaultValue: "",
    value: "",
  },
  {
    id: "budget-owner",
    label: "Budget Owner",
    placeholder: "",
    defaultValue: "",
    value: "",
  },
  {
    id: "reference-id",
    label: "Reference ID",
    placeholder: "",
    defaultValue: "",
    value: "",
  },
];

const lowlight = createLowlight();

lowlight.register({
  bash,
  css,
  html,
  java,
  javascript,
  js: javascript,
  python,
  typescript,
  ts: typescript,
});

const settingsNodeTypeOptions = [
  { value: "heading", label: "Heading" },
  { value: "table", label: "Table" },
  { value: "callout", label: "Callout" },
  { value: "dueDate", label: "Due date" },
  { value: "tabsBlock", label: "Tabs block" },
  { value: "nestedPage", label: "Nested page" },
  { value: "codeBlock", label: "Code block" },
  { value: "variableField", label: "Variable token" },
] as const satisfies ReadonlyArray<{ value: SettingsNodeType; label: string }>;

const defaultNodeSettings: NodeSettings = {
  heading: { enabled: true },
  table: { enabled: true, headerBgColor: "token:surface-2" },
  callout: {
    enabled: true,
    backgroundColor: "token:surface-2",
    borderColor: "token:accent",
    fontColor: "token:fg",
  },
  dueDate: { enabled: true },
  tabsBlock: { enabled: true },
  nestedPage: { enabled: true },
  codeBlock: {
    enabled: true,
    syntaxTheme: "palette",
    backgroundColor: "hsl(var(--surface-2) / 0.36)",
    borderColor: "token:border",
    toolbarBackgroundColor: "token:surface",
    toolbarBorderColor: "token:border",
    textColor: "token:fg",
    controlBackgroundColor: "token:surface",
    controlTextColor: "token:fg",
  },
  variableField: { enabled: true },
};

const slashCommandToNodeType: Partial<Record<string, SettingsNodeType>> = {
  h1: "heading",
  h2: "heading",
  h3: "heading",
  table: "table",
  "tabs-block": "tabsBlock",
  "nested-page": "nestedPage",
  "code-block": "codeBlock",
  callout: "callout",
};

const nodeColorTokenOptions = [
  { value: "token:surface", label: "Surface" },
  { value: "token:surface-2", label: "Surface 2" },
  { value: "token:bg", label: "Background" },
  { value: "token:border", label: "Border" },
  { value: "token:fg", label: "Foreground" },
  { value: "token:muted", label: "Muted" },
  { value: "token:accent", label: "Accent" },
  { value: "token:info", label: "Info" },
  { value: "token:success", label: "Success" },
  { value: "token:warning", label: "Warning" },
  { value: "token:danger", label: "Danger" },
] as const;

type CodeBlockColorKey = Exclude<
  keyof NodeSettings["codeBlock"],
  "enabled" | "syntaxTheme"
>;

const codeBlockSyntaxThemeOptions: ReadonlyArray<{
  value: CodeBlockSyntaxTheme;
  label: string;
}> = [
  { value: "palette", label: "Palette (current theme)" },
  { value: "github", label: "GitHub" },
  { value: "github-dark", label: "GitHub Dark" },
  { value: "github-dark-dimmed", label: "GitHub Dark Dimmed" },
  { value: "atom-one-light", label: "Atom One Light" },
  { value: "atom-one-dark", label: "Atom One Dark" },
  { value: "stackoverflow-light", label: "StackOverflow Light" },
  { value: "stackoverflow-dark", label: "StackOverflow Dark" },
  { value: "vs", label: "Visual Studio" },
  { value: "vs2015", label: "Visual Studio 2015" },
  { value: "tokyo-night-dark", label: "Tokyo Night Dark" },
  { value: "night-owl", label: "Night Owl" },
] as const;

const codeBlockColorFieldOptions: ReadonlyArray<{
  key: CodeBlockColorKey;
  label: string;
  fallback: string;
}> = [
  { key: "backgroundColor", label: "Block Background", fallback: "#eef2f7" },
  { key: "borderColor", label: "Block Border", fallback: "#c7d1e0" },
  {
    key: "toolbarBackgroundColor",
    label: "Toolbar Background",
    fallback: "#ffffff",
  },
  { key: "toolbarBorderColor", label: "Toolbar Border", fallback: "#c7d1e0" },
  { key: "textColor", label: "Code Text", fallback: "#1f2937" },
  {
    key: "controlBackgroundColor",
    label: "Control Background",
    fallback: "#ffffff",
  },
  { key: "controlTextColor", label: "Control Text", fallback: "#1f2937" },
] as const;

function normalizeInput(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function isTokenColorValue(value: string): boolean {
  return value.startsWith("token:");
}

function resolveColorValue(value: string): string {
  if (!isTokenColorValue(value)) {
    return value;
  }

  const token = value.slice("token:".length);
  return `hsl(var(--${token}))`;
}

function colorInputValue(value: string, fallback: string): string {
  return isTokenColorValue(value) ? fallback : value;
}

function toVariableId(label: string, existing: Set<string>): string {
  const base = normalizeInput(label)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "") || "variable";

  let nextId = base;
  let count = 2;

  while (existing.has(nextId)) {
    nextId = `${base}-${count}`;
    count += 1;
  }

  return nextId;
}

function resolveVariable(definition: VariableDefinition): VariableResolution {
  const explicit = definition.value.trim();
  if (explicit.length > 0) {
    return { displayValue: definition.value, state: "set" };
  }

  const fallback = definition.defaultValue.trim();
  if (fallback.length > 0) {
    return { displayValue: definition.defaultValue, state: "set" };
  }

  const placeholder = normalizeInput(definition.placeholder);
  if (placeholder.length > 0) {
    return { displayValue: placeholder, state: "placeholder" };
  }

  return { displayValue: definition.label, state: "unset" };
}

function variableKeywords(definition: VariableDefinition): string {
  return `${definition.label} ${definition.placeholder} ${definition.defaultValue} variable field token`;
}

const statusMeta: Record<StatusValue, { label: string; hint: string }> = {
  todo: {
    label: "Todo",
    hint: "Queued and not started",
  },
  in_progress: {
    label: "In progress",
    hint: "Actively being worked on",
  },
  done: {
    label: "Done",
    hint: "Completed and delivered",
  },
  archived: {
    label: "Archived",
    hint: "Parked for future reference",
  },
};
const statusIcons = {
  todo: TbCircle,
  in_progress: TbCircleHalf2,
  done: TbCircleCheck,
  archived: TbCircleOff,
} as const;
const compactToolbarQuery = "(max-width: 767px)";

const applyTaskStatus = (
  editor: NonNullable<ReturnType<typeof useEditor>>,
  status: StatusValue,
) => {
  const chain = editor.chain().focus();

  if (!editor.isActive("taskList")) {
    chain.toggleTaskList();
  }

  chain.setTaskStatus(status).run();
};

const baseSlashCommands: SlashCommand[] = [
  {
    id: "h1",
    label: "Heading 1",
    hint: "Large section heading",
    keywords: "title h1 heading",
    icon: TbHeading,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Heading 2",
    hint: "Medium section heading",
    keywords: "subtitle h2 heading",
    icon: TbHeading,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Heading 3",
    hint: "Small section heading",
    keywords: "subheading h3 heading",
    icon: TbHeading,
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "table",
    label: "Table",
    hint: "Insert a 3x3 table",
    keywords: "table grid rows columns",
    icon: TbTable,
    run: (editor) =>
      editor.chain().focus().insertTable({
        rows: 3,
        cols: 3,
        withHeaderRow: true,
      }).run(),
  },
  {
    id: "tabs-block",
    label: "Tabs",
    hint: "Insert a tabs wrapper block",
    keywords: "tabs tabbed wrapper sections",
    icon: TbColumns2,
    run: (editor) => editor.chain().focus().insertTabsBlock().run(),
  },
  {
    id: "nested-page",
    label: "Nested page",
    hint: "Insert a nested page link block",
    keywords: "nested page child subpage linked page",
    icon: TbLink,
    run: (editor) => editor.chain().focus().insertNestedPage().run(),
  },
  {
    id: "bullet",
    label: "Bullet list",
    hint: "Start a bulleted list",
    keywords: "list bullets ul",
    icon: TbList,
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "checklist",
    label: "Checklist",
    hint: "Insert a status checklist item",
    keywords: "todo task list checkbox",
    icon: TbList,
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: "code-block",
    label: "Code block",
    hint: "Add formatted code",
    keywords: "code snippet pre",
    icon: TbCode,
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "callout",
    label: "Callout",
    hint: "Highlight important notes",
    keywords: "alert note block",
    icon: TbAlertCircle,
    run: (editor) => editor.chain().focus().toggleWrap("callout").run(),
  },
  {
    id: "quote",
    label: "Quote",
    hint: "Insert a quote block",
    keywords: "quote citation blockquote",
    icon: TbBlockquote,
    run: (editor) => editor.chain().focus().toggleWrap("blockquote").run(),
  },
  {
    id: "format-bold",
    label: "Bold",
    hint: "Toggle bold text",
    keywords: "format bold b strong",
    icon: TbBold,
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    id: "format-italic",
    label: "Italic",
    hint: "Toggle italic text",
    keywords: "format italic i emphasis",
    icon: TbItalic,
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    id: "format-underline",
    label: "Underline",
    hint: "Toggle underlined text",
    keywords: "format underline u",
    icon: TbUnderline,
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    id: "format-strike",
    label: "Strikethrough",
    hint: "Toggle strikethrough text",
    keywords: "format strike strikethrough s",
    icon: TbStrikethrough,
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    id: "format-link",
    label: "Link",
    hint: "Apply a link to selection",
    keywords: "format link url",
    icon: TbLink,
    run: (editor) => {
      const previousUrl = editor.getAttributes("link").href as
        | string
        | undefined;
      const url = globalThis.prompt("Enter URL", previousUrl ?? "https://");

      if (url === null) {
        return;
      }

      if (url.trim() === "") {
        editor.chain().focus().unsetLink().run();
        return;
      }

      editor.chain().focus().extendMarkRange("link").setLink({ href: url })
        .run();
    },
  },
];

const baseSlashMenuTree: SlashMenuNode[] = [
  {
    id: "heading-group",
    label: "Heading",
    keywords: "heading title text",
    icon: TbHeading,
    children: [
      {
        id: "node-h1",
        label: "Heading 1",
        keywords: "h1 title",
        icon: TbHeading,
        commandId: "h1",
      },
      {
        id: "node-h2",
        label: "Heading 2",
        keywords: "h2 subtitle",
        icon: TbHeading,
        commandId: "h2",
      },
      {
        id: "node-h3",
        label: "Heading 3",
        keywords: "h3 subheading",
        icon: TbHeading,
        commandId: "h3",
      },
    ],
  },
  {
    id: "node-table",
    label: "Table",
    keywords: "table grid",
    icon: TbTable,
    commandId: "table",
  },
  {
    id: "node-tabs",
    label: "Tabs",
    keywords: "tabs tabbed wrapper sections",
    icon: TbColumns2,
    commandId: "tabs-block",
  },
  {
    id: "node-nested-page",
    label: "Nested page",
    keywords: "nested page linked subpage",
    icon: TbLink,
    commandId: "nested-page",
  },
  {
    id: "list-group",
    label: "List",
    keywords: "list bullet checklist",
    icon: TbList,
    children: [
      {
        id: "node-bullet",
        label: "Bullet list",
        keywords: "bullet list",
        icon: TbList,
        commandId: "bullet",
      },
      {
        id: "node-checklist",
        label: "Checklist",
        keywords: "todo task checklist",
        icon: TbList,
        commandId: "checklist",
      },
    ],
  },
  {
    id: "node-code",
    label: "Code block",
    keywords: "code snippet",
    icon: TbCode,
    commandId: "code-block",
  },
  {
    id: "node-callout",
    label: "Callout",
    keywords: "callout alert note",
    icon: TbAlertCircle,
    commandId: "callout",
  },
  {
    id: "node-quote",
    label: "Quote",
    keywords: "quote citation blockquote",
    icon: TbBlockquote,
    commandId: "quote",
  },
  {
    id: "format-group",
    label: "Format",
    keywords: "format style text b i m",
    icon: TbBold,
    children: [
      {
        id: "node-format-bold",
        label: "Bold",
        keywords: "bold b",
        icon: TbBold,
        commandId: "format-bold",
      },
      {
        id: "node-format-italic",
        label: "Italic",
        keywords: "italic i",
        icon: TbItalic,
        commandId: "format-italic",
      },
      {
        id: "node-format-underline",
        label: "Underline",
        keywords: "underline u",
        icon: TbUnderline,
        commandId: "format-underline",
      },
      {
        id: "node-format-strike",
        label: "Strikethrough",
        keywords: "strike strikethrough",
        icon: TbStrikethrough,
        commandId: "format-strike",
      },
      {
        id: "node-format-link",
        label: "Link",
        keywords: "link url",
        icon: TbLink,
        commandId: "format-link",
      },
    ],
  },
];

function filterSlashMenuNodes(
  nodes: SlashMenuNode[],
  query: string,
): SlashMenuNode[] {
  if (query.length === 0) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const selfMatch = `${node.label} ${node.keywords}`.toLowerCase().includes(
      query,
    );
    const children = node.children
      ? filterSlashMenuNodes(node.children, query)
      : [];

    if (node.children && children.length > 0) {
      return [{ ...node, children }];
    }

    if (node.children && selfMatch) {
      return [{ ...node }];
    }

    if (!node.children && selfMatch) {
      return [node];
    }

    return [];
  });
}

function flattenSlashCommands(
  nodes: SlashMenuNode[],
  commandMap: Map<string, SlashCommand>,
): IndexedSlashCommand[] {
  let index = 0;

  const walk = (source: SlashMenuNode[]): IndexedSlashCommand[] =>
    source.flatMap((node) => {
      const children = node.children ? walk(node.children) : [];

      if (!node.commandId) {
        return children;
      }

      const command = commandMap.get(node.commandId);
      if (!command) {
        return children;
      }

      const entry: IndexedSlashCommand = {
        ...command,
        flatIndex: index++,
      };

      return [entry, ...children];
    });

  return walk(nodes);
}

function isSlashCommandEnabled(
  commandId: string,
  nodeSettings: NodeSettings,
): boolean {
  if (commandId === "variable-manage" || commandId.startsWith("variable:")) {
    return nodeSettings.variableField.enabled;
  }

  const nodeType = slashCommandToNodeType[commandId];
  if (!nodeType) {
    return true;
  }

  return nodeSettings[nodeType].enabled;
}

function filterSlashMenuTreeByNodeSettings(
  nodes: SlashMenuNode[],
  nodeSettings: NodeSettings,
): SlashMenuNode[] {
  return nodes.flatMap((node) => {
    if (node.children) {
      const children = filterSlashMenuTreeByNodeSettings(
        node.children,
        nodeSettings,
      );
      return children.length > 0 ? [{ ...node, children }] : [];
    }

    if (!node.commandId) {
      return [];
    }

    return isSlashCommandEnabled(node.commandId, nodeSettings) ? [node] : [];
  });
}

function getSlashContext(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  container: HTMLElement | null,
): SlashContext | null {
  const { state, view } = editor;
  const { selection } = state;

  if (!selection.empty) {
    return null;
  }

  const { $from } = selection;
  if (!$from.parent.isTextblock) {
    return null;
  }

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, "", "");
  const slashIndex = textBefore.lastIndexOf("/");
  if (slashIndex < 0) {
    return null;
  }

  const charBeforeSlash = textBefore[slashIndex - 1];
  if (slashIndex > 0 && charBeforeSlash && /\S/.test(charBeforeSlash)) {
    return null;
  }

  const query = textBefore.slice(slashIndex + 1);
  if (query.includes(" ")) {
    return null;
  }

  const from = $from.start() + slashIndex;
  const to = selection.from;
  const cursorRect = view.coordsAtPos(selection.from);
  const containerRect = container?.getBoundingClientRect();

  return {
    query,
    from,
    to,
    left: containerRect ? cursorRect.left - containerRect.left : 0,
    top: containerRect ? cursorRect.bottom - containerRect.top : 0,
  };
}

export function NoteEditor({
  initialContent,
  onContentSnapshotChange,
  useSampleNote,
  onUseSampleNoteChange,
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
  onModeChange,
  onBgPaletteChange,
  onPaletteChange,
  onAccentColorChange,
  onAlertSuccessToneChange,
  onAlertSuccessStrengthChange,
  onAlertInfoToneChange,
  onAlertInfoStrengthChange,
  onAlertWarningToneChange,
  onAlertWarningStrengthChange,
  onAlertDangerToneChange,
  onBodyFontChange,
  onHeadingFontChange,
  onFontScaleChange,
  onRadiusChange,
  onElevationChange,
  onResetAppearance,
}: NoteEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const variablePopoverRef = useRef<HTMLDivElement>(null);
  const variablePopoverInputRef = useRef<HTMLInputElement>(null);
  const [slashContext, setSlashContext] = useState<SlashContext | null>(null);
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [variableDrawerOpen, setVariableDrawerOpen] = useState(false);
  const [variableValuePopover, setVariableValuePopover] = useState<
    VariableValuePopover | null
  >(
    null,
  );
  const [highlightUnsetVariables, setHighlightUnsetVariables] = useState(true);
  const [highlightAllVariables, setHighlightAllVariables] = useState(true);
  const [variableDefinitions, setVariableDefinitions] = useState<
    VariableDefinition[]
  >(
    useSampleNote ? seedVariableDefinitions : [],
  );
  const [newVariableLabel, setNewVariableLabel] = useState("");
  const [newVariablePlaceholder, setNewVariablePlaceholder] = useState("");
  const [newVariableDefaultValue, setNewVariableDefaultValue] = useState("");
  const [nodeSettings, setNodeSettings] = useState<NodeSettings>(
    defaultNodeSettings,
  );
  const [activeSettingsSection, setActiveSettingsSection] = useState<
    SettingsSection
  >("general");
  const [selectedSettingsNodeType, setSelectedSettingsNodeType] = useState<
    SettingsNodeType
  >(
    settingsNodeTypeOptions[0].value,
  );
  const [compactToolbar, setCompactToolbar] = useState(() =>
    typeof globalThis.matchMedia === "function"
      ? globalThis.matchMedia(compactToolbarQuery).matches
      : false
  );
  const hasManagedInitialContent = typeof initialContent !== "undefined";
  const contentSnapshotChangeRef = useRef(onContentSnapshotChange);

  useEffect(() => {
    contentSnapshotChangeRef.current = onContentSnapshotChange;
  }, [onContentSnapshotChange]);

  useEffect(() => {
    if (typeof globalThis.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = globalThis.matchMedia(compactToolbarQuery);
    const sync = (): void => {
      setCompactToolbar(mediaQueryList.matches);
    };

    sync();
    mediaQueryList.addEventListener("change", sync);

    return () => {
      mediaQueryList.removeEventListener("change", sync);
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        blockquote: false,
        underline: false,
        link: false,
      }),
      CodeBlockWithTools.configure({ lowlight }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      TaskList,
      StatusTaskItem.configure({ nested: true }),
      DueDate,
      TabsPanel,
      TabsBlock,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: "Write your note...",
      }),
      Callout,
      QuoteBlock,
      NestedPage,
      VariableField,
    ],
    content: initialContent ?? (useSampleNote ? sampleNoteHtml : emptyNoteHtml),
    onUpdate: ({ editor: activeEditor }) => {
      const onSnapshot = contentSnapshotChangeRef.current;

      if (!onSnapshot) {
        return;
      }

      onSnapshot({
        json: activeEditor.getJSON(),
        html: activeEditor.getHTML(),
        plainText: activeEditor.state.doc.textBetween(
          0,
          activeEditor.state.doc.content.size,
          "\n\n",
          "\n",
        ).trimEnd(),
      });
    },
    editorProps: {
      attributes: {
        class: "note-editor min-h-[24rem] text-fg focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    if (hasManagedInitialContent) {
      return;
    }
    if (!nodeSettings.variableField.enabled) {
      return;
    }

    const nextContent = useSampleNote ? sampleNoteHtml : emptyNoteHtml;
    editor.commands.setContent(nextContent, { emitUpdate: true });
    setVariableDefinitions(useSampleNote ? seedVariableDefinitions : []);
    setVariableValuePopover(null);
    setHighlightAllVariables(true);
    setHighlightUnsetVariables(true);
  }, [
    editor,
    hasManagedInitialContent,
    nodeSettings.variableField.enabled,
    useSampleNote,
  ]);

  useEffect(() => {
    if (nodeSettings.variableField.enabled) {
      return;
    }

    setVariableDrawerOpen(false);
    setVariableValuePopover(null);
  }, [nodeSettings.variableField.enabled]);

  const variableById = useMemo(
    () =>
      new Map(
        variableDefinitions.map((definition) => [definition.id, definition]),
      ),
    [variableDefinitions],
  );
  const activePopoverDefinition = variableValuePopover
    ? variableById.get(variableValuePopover.variableId) ?? null
    : null;

  const insertVariableMention = useCallback(
    (
      currentEditor: NonNullable<ReturnType<typeof useEditor>>,
      variableId: string,
    ) => {
      const variable = variableById.get(variableId);
      if (!variable) {
        return;
      }

      const resolution = resolveVariable(variable);
      currentEditor.chain().focus().insertContent([
        {
          type: "variableField",
          attrs: {
            variableId: variable.id,
            variableLabel: variable.label,
            displayValue: resolution.displayValue,
            variableState: resolution.state,
            unset: resolution.state === "unset",
          },
        },
        { type: "text", text: " " },
      ]).run();
    },
    [variableById],
  );

  const variableSlashCommands = useMemo<SlashCommand[]>(
    () =>
      variableDefinitions.map((definition) => ({
        id: `variable:${definition.id}`,
        label: definition.label,
        hint: "Insert variable field",
        keywords: variableKeywords(definition),
        icon: TbVariable,
        run: (currentEditor) => {
          insertVariableMention(currentEditor, definition.id);
        },
      })),
    [insertVariableMention, variableDefinitions],
  );

  const manageVariablesCommand = useMemo<SlashCommand>(
    () => ({
      id: "variable-manage",
      label: variableDefinitions.length > 0
        ? "Manage variables"
        : "Create variable",
      hint: "Open variable drawer",
      keywords: "variables fields placeholders tokens drawer",
      icon: TbVariablePlus,
      run: () => setVariableDrawerOpen(true),
    }),
    [variableDefinitions.length],
  );

  const slashCommands = useMemo(
    () => [
      ...baseSlashCommands.filter((command) =>
        isSlashCommandEnabled(command.id, nodeSettings)
      ),
      ...(nodeSettings.variableField.enabled ? variableSlashCommands : []),
      ...(nodeSettings.variableField.enabled ? [manageVariablesCommand] : []),
    ],
    [manageVariablesCommand, nodeSettings, variableSlashCommands],
  );

  const slashMenuTree = useMemo<SlashMenuNode[]>(
    () => {
      const nextTree: SlashMenuNode[] = filterSlashMenuTreeByNodeSettings(
        baseSlashMenuTree,
        nodeSettings,
      );

      if (nodeSettings.variableField.enabled) {
        nextTree.push({
          id: "variables-group",
          label: "Variables",
          keywords: "variable field token placeholder",
          icon: TbVariable,
          children: [
            ...variableDefinitions.map((definition) => ({
              id: `node-variable-${definition.id}`,
              label: definition.label,
              keywords: variableKeywords(definition),
              icon: TbVariable,
              commandId: `variable:${definition.id}`,
            })),
            {
              id: "node-variable-manage",
              label: variableDefinitions.length > 0
                ? "Manage variables"
                : "Create variable",
              keywords: "variable drawer settings",
              icon: TbVariablePlus,
              commandId: "variable-manage",
            },
          ],
        });
      }

      return nextTree;
    },
    [nodeSettings, variableDefinitions],
  );

  const slashCommandById = useMemo(
    () => new Map(slashCommands.map((command) => [command.id, command])),
    [slashCommands],
  );

  const filteredSlashMenuNodes = useMemo(() => {
    const query = slashContext?.query.trim().toLowerCase() ?? "";
    return filterSlashMenuNodes(slashMenuTree, query);
  }, [slashContext?.query, slashMenuTree]);

  const flatFilteredSlashCommands = useMemo(
    () => flattenSlashCommands(filteredSlashMenuNodes, slashCommandById),
    [filteredSlashMenuNodes, slashCommandById],
  );

  const slashDropdownItems = useMemo<DropdownItem[]>(
    () => {
      const toDropdownItems = (nodes: SlashMenuNode[]): DropdownItem[] =>
        nodes.map((node) => {
          const Icon = node.icon;

          if (node.children?.length) {
            return {
              id: node.id,
              label: node.label,
              icon: <Icon aria-hidden size={16} strokeWidth={1.9} />,
              children: toDropdownItems(node.children),
            };
          }

          const commandId = node.commandId ?? node.id;
          return {
            id: commandId,
            label: node.label,
            icon: <Icon aria-hidden size={16} strokeWidth={1.9} />,
          };
        });

      return toDropdownItems(filteredSlashMenuNodes);
    },
    [filteredSlashMenuNodes],
  );

  const activeCommandIndex = flatFilteredSlashCommands.length > 0
    ? Math.min(activeSlashIndex, flatFilteredSlashCommands.length - 1)
    : 0;

  useEffect(() => {
    if (!editor) {
      return;
    }

    const syncSlashMenu = () => {
      setSlashContext(getSlashContext(editor, wrapperRef.current));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!slashContext) {
        return;
      }
      if (flatFilteredSlashCommands.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSlashIndex((prev) =>
          Math.min(prev + 1, flatFilteredSlashCommands.length - 1)
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSlashIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setSlashContext(null);
        setActiveSlashIndex(0);
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        const command = flatFilteredSlashCommands[activeCommandIndex];
        if (!command) {
          return;
        }

        event.preventDefault();
        editor.chain().focus().deleteRange(slashContext).run();
        command.run(editor);
        setSlashContext(null);
        setActiveSlashIndex(0);
      }
    };

    syncSlashMenu();
    editor.on("update", syncSlashMenu);
    editor.on("selectionUpdate", syncSlashMenu);
    editor.on("focus", syncSlashMenu);
    editor.view.dom.addEventListener("keydown", onKeyDown);

    return () => {
      editor.off("update", syncSlashMenu);
      editor.off("selectionUpdate", syncSlashMenu);
      editor.off("focus", syncSlashMenu);
      editor.view.dom.removeEventListener("keydown", onKeyDown);
    };
  }, [activeCommandIndex, editor, flatFilteredSlashCommands, slashContext]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const variableNodeType = editor.schema.nodes.variableField;
    if (!variableNodeType) {
      return;
    }

    const definitions = new Map(
      variableDefinitions.map((definition) => [definition.id, definition]),
    );
    let tr = editor.state.tr;
    let changed = false;

    editor.state.doc.descendants((node, position) => {
      if (node.type !== variableNodeType) {
        return;
      }

      const variableId = typeof node.attrs.variableId === "string"
        ? node.attrs.variableId
        : "";
      const definition = definitions.get(variableId);
      if (!definition) {
        return;
      }

      const resolution = resolveVariable(definition);
      const currentUnset = node.attrs.unset === true ||
        node.attrs.unset === "true";
      const currentState = node.attrs.variableState === "set" ||
          node.attrs.variableState === "placeholder" ||
          node.attrs.variableState === "unset"
        ? node.attrs.variableState
        : currentUnset
        ? "unset"
        : "set";

      if (
        node.attrs.variableLabel === definition.label &&
        node.attrs.displayValue === resolution.displayValue &&
        currentUnset === (resolution.state === "unset") &&
        currentState === resolution.state
      ) {
        return;
      }

      tr = tr.setNodeMarkup(position, undefined, {
        ...node.attrs,
        variableLabel: definition.label,
        displayValue: resolution.displayValue,
        variableState: resolution.state,
        unset: resolution.state === "unset",
      }, node.marks);
      changed = true;
    });

    if (changed) {
      editor.view.dispatch(tr);
    }
  }, [editor, variableDefinitions]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const openVariableValuePopover = (
      field: HTMLElement,
      variableId: string,
      definition: VariableDefinition,
    ) => {
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      const fieldRect = field.getBoundingClientRect();
      const panelWidth = 280;
      const leftEdge = wrapperRect ? fieldRect.left - wrapperRect.left : 8;
      const maxLeft = wrapperRect
        ? Math.max(8, wrapperRect.width - panelWidth - 8)
        : leftEdge;
      const left = Math.max(8, Math.min(leftEdge, maxLeft));
      const top = wrapperRect
        ? fieldRect.bottom - wrapperRect.top + 6
        : fieldRect.bottom + 6;

      setVariableValuePopover({
        variableId,
        left,
        top,
        draftValue: definition.value,
      });
    };

    const onDoubleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const field = target.closest('[data-type="variableField"]');
      if (field instanceof HTMLElement) {
        const variableId = field.getAttribute("data-variable-id");
        if (!variableId) {
          return;
        }

        const definition = variableById.get(variableId);
        if (!definition) {
          return;
        }

        event.preventDefault();
        openVariableValuePopover(field, variableId, definition);
      }
    };

    editor.view.dom.addEventListener("dblclick", onDoubleClick);
    return () => {
      editor.view.dom.removeEventListener("dblclick", onDoubleClick);
    };
  }, [editor, nodeSettings.variableField.enabled, variableById]);

  useEffect(() => {
    if (!variableValuePopover) {
      return;
    }

    if (!variableById.has(variableValuePopover.variableId)) {
      setVariableValuePopover(null);
    }
  }, [variableById, variableValuePopover]);

  useEffect(() => {
    if (!variableValuePopover) {
      return;
    }

    variablePopoverInputRef.current?.focus();
    variablePopoverInputRef.current?.select();
  }, [variableValuePopover]);

  useEffect(() => {
    if (!variableValuePopover) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (variablePopoverRef.current?.contains(target)) {
        return;
      }

      setVariableValuePopover(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setVariableValuePopover(null);
    };

    globalThis.addEventListener("mousedown", onMouseDown);
    globalThis.addEventListener("keydown", onKeyDown);

    return () => {
      globalThis.removeEventListener("mousedown", onMouseDown);
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [variableValuePopover]);

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) {
        return {
          activeHeadingLevel: null as 1 | 2 | 3 | null,
          activeTaskStatus: undefined as StatusValue | undefined,
          bold: false,
          italic: false,
          underline: false,
          strike: false,
          link: false,
          bulletList: false,
          taskList: false,
          taskItem: false,
          codeBlock: false,
          table: false,
          callout: false,
          dueDate: false,
          tabsBlock: false,
          nestedPage: false,
        };
      }

      const activeHeadingLevel = ([1, 2, 3] as const).find((level) =>
        editor.isActive("heading", { level })
      ) ?? null;

      return {
        activeHeadingLevel,
        activeTaskStatus: editor.isActive("taskItem")
          ? (editor.getAttributes("taskItem").status as StatusValue | undefined)
          : undefined,
        bold: editor.isActive("bold"),
        italic: editor.isActive("italic"),
        underline: editor.isActive("underline"),
        strike: editor.isActive("strike"),
        link: editor.isActive("link"),
        bulletList: editor.isActive("bulletList"),
        taskList: editor.isActive("taskList"),
        taskItem: editor.isActive("taskItem"),
        codeBlock: editor.isActive("codeBlock"),
        table: editor.isActive("table"),
        callout: editor.isActive("callout"),
        dueDate: editor.isActive("dueDate"),
        tabsBlock: editor.isActive("tabsBlock"),
        nestedPage: editor.isActive("nestedPage"),
      };
    },
  });

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = globalThis.prompt("Enter URL", previousUrl ?? "https://");

    if (url === null) {
      return;
    }

    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const copyTextToClipboard = useCallback(async (value: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }, []);

  const downloadTextFile = useCallback((
    value: string,
    mimeType: string,
    extension: string,
  ) => {
    const blob = new Blob([value], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `note-export-${timestamp}.${extension}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    globalThis.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }, []);

  const getExportPlainText = useCallback(() => {
    return editor.state.doc.textBetween(
      0,
      editor.state.doc.content.size,
      "\n\n",
      "\n",
    ).trimEnd();
  }, [editor]);

  const getExportMarkdown = useCallback(() => {
    const parser = new DOMParser();
    const html = editor.getHTML();
    const documentNode = parser.parseFromString(html, "text/html");
    const blockTags = new Set([
      "article",
      "aside",
      "blockquote",
      "div",
      "figure",
      "footer",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "header",
      "hr",
      "li",
      "main",
      "ol",
      "p",
      "pre",
      "section",
      "table",
      "ul",
    ]);

    const normalizeInlineWhitespace = (value: string) =>
      value
        .replaceAll("\u00a0", " ")
        .replace(/[ \t]+/g, " ")
        .replace(/ *\n */g, "\n");

    const inlineFromNodes = (nodes: globalThis.Node[]): string =>
      normalizeInlineWhitespace(nodes.map((node) => toInline(node)).join(""));

    const inlineFromChildren = (node: ParentNode): string =>
      inlineFromNodes(Array.from(node.childNodes));

    const escapeCodeFence = (value: string) =>
      value.replaceAll("```", "\\`\\`\\`");

    const toInline = (node: globalThis.Node): string => {
      if (node.nodeType === globalThis.Node.TEXT_NODE) {
        return node.textContent ?? "";
      }

      if (node.nodeType !== globalThis.Node.ELEMENT_NODE) {
        return "";
      }

      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();

      if (tag === "br") {
        return "  \n";
      }

      if (tag === "code" && element.closest("pre")) {
        return element.textContent ?? "";
      }

      const content = inlineFromChildren(element);

      switch (tag) {
        case "strong":
        case "b":
          return `**${content}**`;
        case "em":
        case "i":
          return `*${content}*`;
        case "s":
        case "strike":
        case "del":
          return `~~${content}~~`;
        case "code":
          return `\`${content.replaceAll("`", "\\`")}\``;
        case "a": {
          const href = element.getAttribute("href") ?? "";
          const label = content.trim() || href;
          return href.length > 0 ? `[${label}](${href})` : label;
        }
        default:
          return content;
      }
    };

    const tableToMarkdown = (table: HTMLElement): string => {
      const rows = Array.from(table.querySelectorAll("tr"));
      if (rows.length === 0) {
        return "";
      }

      const toCellText = (cell: HTMLTableCellElement): string =>
        inlineFromChildren(cell).replace(/\|/g, "\\|").trim();

      const matrix = rows.map((row) =>
        Array.from(row.querySelectorAll("th, td")).map((cell) =>
          toCellText(cell as HTMLTableCellElement)
        )
      ).filter((row) => row.length > 0);

      if (matrix.length === 0) {
        return "";
      }

      const width = Math.max(...matrix.map((row) => row.length));
      const fill = (
        row: string[],
      ) => [
        ...row,
        ...Array.from({ length: Math.max(0, width - row.length) }, () => ""),
      ];
      const header = fill(matrix[0] ?? []);
      const body = matrix.slice(1).map(fill);

      const lines = [
        `| ${header.join(" | ")} |`,
        `| ${header.map(() => "---").join(" | ")} |`,
        ...body.map((row) => `| ${row.join(" | ")} |`),
      ];

      return lines.join("\n");
    };

    const getQuoteFooter = (quoteElement: HTMLElement): {
      value: string | null;
      href: string | null;
    } => {
      const valueFromData = normalizeInlineWhitespace(
        quoteElement.getAttribute("data-quote-footer-value") ?? "",
      ).trim();
      const hrefFromData = normalizeInlineWhitespace(
        quoteElement.getAttribute("data-quote-footer-href") ?? "",
      ).trim();

      if (valueFromData.length > 0 || hrefFromData.length > 0) {
        return {
          value: valueFromData.length > 0 ? valueFromData : null,
          href: hrefFromData.length > 0 ? hrefFromData : null,
        };
      }

      const directFooter = Array.from(quoteElement.children).find((child) =>
        child.tagName.toLowerCase() === "footer"
      );

      if (!(directFooter instanceof HTMLElement)) {
        return { value: null, href: null };
      }

      const footerLink = directFooter.querySelector("a");
      const valueFromFooter = normalizeInlineWhitespace(
        footerLink?.textContent ?? directFooter.textContent ?? "",
      ).trim();
      const hrefFromFooter = normalizeInlineWhitespace(
        footerLink?.getAttribute("href") ?? "",
      ).trim();

      return {
        value: valueFromFooter.length > 0 ? valueFromFooter : null,
        href: hrefFromFooter.length > 0 ? hrefFromFooter : null,
      };
    };

    const toBlock = (node: globalThis.Node, listDepth = 0): string => {
      if (node.nodeType === globalThis.Node.TEXT_NODE) {
        const text = normalizeInlineWhitespace(node.textContent ?? "").trim();
        return text;
      }

      if (node.nodeType !== globalThis.Node.ELEMENT_NODE) {
        return "";
      }

      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();

      switch (tag) {
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6": {
          const level = Number.parseInt(tag.slice(1), 10);
          const content = inlineFromChildren(element).trim();
          return `${"#".repeat(level)} ${content}`.trim();
        }
        case "p":
          return inlineFromChildren(element).trim();
        case "hr":
          return "---";
        case "pre": {
          const codeElement = element.querySelector("code");
          const className = codeElement?.className ?? "";
          const language = className
            .split(/\s+/)
            .find((token) => token.startsWith("language-"))
            ?.slice("language-".length) ?? "";
          const rawCode = codeElement?.textContent ?? element.textContent ?? "";
          return `\`\`\`${language}\n${
            escapeCodeFence(rawCode).replace(/\n+$/g, "")
          }\n\`\`\``;
        }
        case "blockquote": {
          const quoteContentContainer = element.querySelector(
            ":scope > [data-quote-content]",
          );
          const quoteBodyNodes = quoteContentContainer
            ? Array.from(quoteContentContainer.childNodes)
            : Array.from(element.childNodes).filter((child) => {
              if (child.nodeType !== globalThis.Node.ELEMENT_NODE) {
                return true;
              }

              return (child as HTMLElement).tagName.toLowerCase() !== "footer";
            });

          const content = quoteBodyNodes
            .map((child) => toBlock(child, listDepth))
            .filter((entry) => entry.length > 0)
            .join("\n\n")
            .trim();
          const quoteFooter = getQuoteFooter(element);
          const footerText = quoteFooter.href
            ? `[${quoteFooter.value ?? quoteFooter.href}](${quoteFooter.href})`
            : quoteFooter.value;
          const mergedContent = footerText
            ? [content, `Source: ${footerText}`].filter(Boolean).join("\n\n")
            : content;

          if (!mergedContent) {
            return "";
          }
          return mergedContent.split("\n").map((line) => `> ${line}`).join(
            "\n",
          );
        }
        case "ul":
        case "ol": {
          const ordered = tag === "ol";
          const listItems = Array.from(element.children)
            .filter((child) => child.tagName.toLowerCase() === "li");

          return listItems.map((child, index) => {
            const marker = ordered ? `${index + 1}.` : "-";
            const li = child as HTMLElement;
            const inlineNodes = Array.from(li.childNodes).filter((entry) => {
              if (entry.nodeType !== globalThis.Node.ELEMENT_NODE) {
                return true;
              }
              const childTag = (entry as HTMLElement).tagName.toLowerCase();
              return childTag !== "ul" && childTag !== "ol";
            });
            const inlineContent = inlineFromNodes(inlineNodes).trim();
            const prefix = `${"  ".repeat(listDepth)}${marker} `;
            const line = `${prefix}${inlineContent}`.trimEnd();

            const nested = Array.from(li.children)
              .filter((entry) => {
                const childTag = entry.tagName.toLowerCase();
                return childTag === "ul" || childTag === "ol";
              })
              .map((entry) => toBlock(entry, listDepth + 1))
              .filter((entry) => entry.length > 0)
              .join("\n");

            return nested.length > 0 ? `${line}\n${nested}` : line;
          }).join("\n");
        }
        case "table":
          return tableToMarkdown(element);
        case "div":
        case "section":
        case "article":
        case "main":
        case "header":
        case "footer":
        case "aside":
        case "figure": {
          const children = Array.from(element.childNodes)
            .map((child) => toBlock(child, listDepth))
            .filter((entry) => entry.length > 0);
          if (children.length > 0) {
            return children.join("\n\n");
          }
          return inlineFromChildren(element).trim();
        }
        default: {
          if (blockTags.has(tag)) {
            return inlineFromChildren(element).trim();
          }
          return toInline(element);
        }
      }
    };

    const markdown = Array.from(documentNode.body.childNodes)
      .map((child) => toBlock(child))
      .filter((entry) => entry.length > 0)
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return markdown;
  }, [editor]);

  const getExportHtmlDocument = useCallback(() => {
    const escapeAttribute = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    const rootDataAttributes = Array.from(document.documentElement.attributes)
      .filter((attribute) => attribute.name.startsWith("data-"))
      .map((attribute) =>
        `${attribute.name}="${escapeAttribute(attribute.value)}"`
      )
      .join(" ");

    const stylesheetBlocks: string[] = [];
    for (const stylesheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(stylesheet.cssRules).map((rule) =>
          rule.cssText
        ).join("\n");
        if (rules.length > 0) {
          stylesheetBlocks.push(rules);
        }
        continue;
      } catch {
        // Cross-origin or unavailable stylesheet; fall back to owner node if possible.
      }

      const ownerNode = stylesheet.ownerNode;
      if (ownerNode instanceof HTMLStyleElement) {
        const text = ownerNode.textContent?.trim() ?? "";
        if (text.length > 0) {
          stylesheetBlocks.push(text);
        }
      }
    }

    const content = editor.getHTML();
    const mode = document.documentElement.getAttribute("data-mode") ?? "light";

    return [
      "<!doctype html>",
      `<html ${rootDataAttributes}>`,
      "<head>",
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      "<title>Note Export</title>",
      "<style>",
      stylesheetBlocks.join("\n"),
      "</style>",
      "</head>",
      `<body data-mode="${escapeAttribute(mode)}">`,
      '<main style="max-width: 56rem; margin: 0 auto; padding: 1.5rem;">',
      `<div class="note-editor">${content}</div>`,
      "</main>",
      "</body>",
      "</html>",
    ].join("");
  }, [editor]);

  const downloadExportHtml = useCallback(async () => {
    const documentHtml = await getExportHtmlDocument();
    downloadTextFile(documentHtml, "text/html;charset=utf-8", "html");
  }, [downloadTextFile, getExportHtmlDocument]);

  const copyExportHtml = useCallback(async () => {
    const documentHtml = await getExportHtmlDocument();
    await copyTextToClipboard(documentHtml);
  }, [copyTextToClipboard, getExportHtmlDocument]);

  const downloadExportText = useCallback(() => {
    const text = getExportPlainText();
    downloadTextFile(text, "text/plain;charset=utf-8", "txt");
  }, [downloadTextFile, getExportPlainText]);

  const copyExportText = useCallback(async () => {
    const text = getExportPlainText();
    await copyTextToClipboard(text);
  }, [copyTextToClipboard, getExportPlainText]);

  const downloadExportMarkdown = useCallback(() => {
    const markdown = getExportMarkdown();
    downloadTextFile(markdown, "text/markdown;charset=utf-8", "md");
  }, [downloadTextFile, getExportMarkdown]);

  const copyExportMarkdown = useCallback(async () => {
    const markdown = getExportMarkdown();
    await copyTextToClipboard(markdown);
  }, [copyTextToClipboard, getExportMarkdown]);

  const getExportJson = useCallback(() => {
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      note: {
        content: {
          json: editor.getJSON(),
          html: editor.getHTML(),
          text: getExportPlainText(),
          markdown: getExportMarkdown(),
        },
        variables: {
          definitions: variableDefinitions,
          highlightAll: highlightAllVariables,
          highlightUnset: highlightUnsetVariables,
        },
        nodeSettings,
      },
      appearance: {
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
      },
      metadata: {
        useSampleNote,
      },
    };

    return JSON.stringify(payload, null, 2);
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
    editor,
    elevation,
    fontScale,
    getExportMarkdown,
    getExportPlainText,
    headingFont,
    highlightAllVariables,
    highlightUnsetVariables,
    mode,
    nodeSettings,
    palette,
    radius,
    useSampleNote,
    variableDefinitions,
  ]);

  const downloadExportJson = useCallback(() => {
    const json = getExportJson();
    downloadTextFile(json, "application/json;charset=utf-8", "json");
  }, [downloadTextFile, getExportJson]);

  const copyExportJson = useCallback(async () => {
    const json = getExportJson();
    await copyTextToClipboard(json);
  }, [copyTextToClipboard, getExportJson]);

  const shareDropdownItems = useMemo<DropdownItem[]>(
    () => [
      {
        id: "share-html-group",
        label: "HTML",
        icon: <TbFileCode aria-hidden size={16} strokeWidth={1.9} />,
        children: [
          {
            id: "share-download-html",
            label: "Download as HTML",
            icon: <TbDownload aria-hidden size={16} strokeWidth={1.9} />,
          },
          {
            id: "share-copy-html",
            label: "Copy HTML",
            icon: <TbCopy aria-hidden size={16} strokeWidth={1.9} />,
          },
        ],
      },
      {
        id: "share-text-group",
        label: "Text",
        icon: <TbFileText aria-hidden size={16} strokeWidth={1.9} />,
        children: [
          {
            id: "share-download-text",
            label: "Download as Text",
            icon: <TbDownload aria-hidden size={16} strokeWidth={1.9} />,
          },
          {
            id: "share-copy-text",
            label: "Copy Text",
            icon: <TbCopy aria-hidden size={16} strokeWidth={1.9} />,
          },
        ],
      },
      {
        id: "share-markdown-group",
        label: "Markdown",
        icon: <TbMarkdown aria-hidden size={16} strokeWidth={1.9} />,
        children: [
          {
            id: "share-download-markdown",
            label: "Download as Markdown",
            icon: <TbDownload aria-hidden size={16} strokeWidth={1.9} />,
          },
          {
            id: "share-copy-markdown",
            label: "Copy Markdown",
            icon: <TbCopy aria-hidden size={16} strokeWidth={1.9} />,
          },
        ],
      },
      {
        id: "share-json-group",
        label: "JSON",
        icon: <TbFileCode aria-hidden size={16} strokeWidth={1.9} />,
        children: [
          {
            id: "share-download-json",
            label: "Download as JSON",
            icon: <TbDownload aria-hidden size={16} strokeWidth={1.9} />,
          },
          {
            id: "share-copy-json",
            label: "Copy JSON",
            icon: <TbCopy aria-hidden size={16} strokeWidth={1.9} />,
          },
        ],
      },
    ],
    [],
  );

  const updateVariableDefinition = (
    id: string,
    updates: Partial<VariableDefinition>,
  ) => {
    setVariableDefinitions((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const submitVariableValuePopover = () => {
    if (!variableValuePopover) {
      return;
    }

    updateVariableDefinition(variableValuePopover.variableId, {
      value: variableValuePopover.draftValue,
    });
    setVariableValuePopover(null);
  };

  const unsetFromVariableValuePopover = () => {
    if (!variableValuePopover) {
      return;
    }

    updateVariableDefinition(variableValuePopover.variableId, { value: "" });
    setVariableValuePopover(null);
  };

  const removeVariableMentions = useCallback(
    (id: string, replacement: string) => {
      const variableNodeType = editor.schema.nodes.variableField;
      if (!variableNodeType) {
        return;
      }

      const ranges: Array<{ from: number; to: number }> = [];
      editor.state.doc.descendants((node, position) => {
        if (
          node.type === variableNodeType &&
          typeof node.attrs.variableId === "string" &&
          node.attrs.variableId === id
        ) {
          ranges.push({ from: position, to: position + node.nodeSize });
        }
      });

      if (ranges.length === 0) {
        return;
      }

      let tr = editor.state.tr;
      for (let index = ranges.length - 1; index >= 0; index -= 1) {
        const range = ranges[index];
        if (!range) {
          continue;
        }

        if (replacement.length > 0) {
          tr = tr.replaceWith(
            range.from,
            range.to,
            editor.schema.text(replacement),
          );
        } else {
          tr = tr.delete(range.from, range.to);
        }
      }

      editor.view.dispatch(tr);
    },
    [editor],
  );

  const removeVariableDefinition = (id: string) => {
    const definition = variableById.get(id);
    if (definition) {
      removeVariableMentions(id, resolveVariable(definition).displayValue);
    }

    setVariableDefinitions((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  const addVariableDefinition = () => {
    const label = normalizeInput(newVariableLabel);
    if (label.length === 0) {
      return;
    }

    setVariableDefinitions((previous) => {
      const ids = new Set(previous.map((item) => item.id));
      const id = toVariableId(label, ids);

      return [
        ...previous,
        {
          id,
          label,
          placeholder: newVariablePlaceholder,
          defaultValue: newVariableDefaultValue,
          value: "",
        },
      ];
    });

    setNewVariableLabel("");
    setNewVariablePlaceholder("");
    setNewVariableDefaultValue("");
  };

  const insertVariableFromDrawer = (id: string) => {
    insertVariableMention(editor, id);
    setVariableDrawerOpen(false);
  };

  const selectedSettingsNodeLabel = useMemo(
    () =>
      settingsNodeTypeOptions.find((option) =>
        option.value === selectedSettingsNodeType
      )?.label ?? "Node",
    [selectedSettingsNodeType],
  );

  const nodeStyleVariables = useMemo(
    () =>
      ({
        "--node-table-header-bg": resolveColorValue(
          nodeSettings.table.headerBgColor,
        ),
        "--node-callout-bg": resolveColorValue(
          nodeSettings.callout.backgroundColor,
        ),
        "--node-callout-border": resolveColorValue(
          nodeSettings.callout.borderColor,
        ),
        "--node-callout-font": resolveColorValue(
          nodeSettings.callout.fontColor,
        ),
        "--node-code-block-bg": resolveColorValue(
          nodeSettings.codeBlock.backgroundColor,
        ),
        "--node-code-block-border": resolveColorValue(
          nodeSettings.codeBlock.borderColor,
        ),
        "--node-code-toolbar-bg": resolveColorValue(
          nodeSettings.codeBlock.toolbarBackgroundColor,
        ),
        "--node-code-toolbar-border": resolveColorValue(
          nodeSettings.codeBlock.toolbarBorderColor,
        ),
        "--node-code-text": resolveColorValue(nodeSettings.codeBlock.textColor),
        "--node-code-control-bg": resolveColorValue(
          nodeSettings.codeBlock.controlBackgroundColor,
        ),
        "--node-code-control-text": resolveColorValue(
          nodeSettings.codeBlock.controlTextColor,
        ),
      }) as CSSProperties,
    [
      nodeSettings.callout.backgroundColor,
      nodeSettings.callout.borderColor,
      nodeSettings.callout.fontColor,
      nodeSettings.codeBlock.backgroundColor,
      nodeSettings.codeBlock.borderColor,
      nodeSettings.codeBlock.controlBackgroundColor,
      nodeSettings.codeBlock.controlTextColor,
      nodeSettings.codeBlock.textColor,
      nodeSettings.codeBlock.toolbarBackgroundColor,
      nodeSettings.codeBlock.toolbarBorderColor,
      nodeSettings.table.headerBgColor,
    ],
  );

  const showHeadingControls = nodeSettings.heading.enabled;
  const showBlockInsertGroup = nodeSettings.codeBlock.enabled ||
    nodeSettings.table.enabled ||
    nodeSettings.callout.enabled;
  const showDueDateControls = nodeSettings.dueDate.enabled;
  const showLayoutControls = nodeSettings.tabsBlock.enabled ||
    nodeSettings.nestedPage.enabled;

  const toolbarGroupClass =
    "inline-flex items-center rounded-md border border-border bg-surface p-0.5 shadow-soft";
  const toolbarGroupButtonClass =
    "inline-flex h-7 w-7 items-center justify-center rounded-sm text-fg transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";
  const toolbarGroupButtonActiveClass =
    "bg-accent text-accent-contrast hover:bg-accent";
  const toolbarDropdownTriggerClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-fg shadow-soft transition hover:bg-surface-2";
  const formattingToolbarActive = toolbarState.bold ||
    toolbarState.italic ||
    toolbarState.underline ||
    toolbarState.strike ||
    toolbarState.link;
  const taskToolbarActive = toolbarState.bulletList ||
    toolbarState.taskList ||
    toolbarState.taskItem;
  const formattingDropdownItems: DropdownItem[] = [
    {
      id: "toolbar-format-bold",
      label: "Bold",
      icon: <TbBold aria-hidden size={16} strokeWidth={1.9} />,
    },
    {
      id: "toolbar-format-italic",
      label: "Italic",
      icon: <TbItalic aria-hidden size={16} strokeWidth={1.9} />,
    },
    {
      id: "toolbar-format-underline",
      label: "Underline",
      icon: <TbUnderline aria-hidden size={16} strokeWidth={1.9} />,
    },
    {
      id: "toolbar-format-strike",
      label: "Strikethrough",
      icon: <TbStrikethrough aria-hidden size={16} strokeWidth={1.9} />,
    },
    {
      id: "toolbar-format-link",
      label: "Link",
      icon: <TbLink aria-hidden size={16} strokeWidth={1.9} />,
    },
  ];
  const taskDropdownItems: DropdownItem[] = [
    {
      id: "toolbar-task-bullets",
      label: "Bullets",
      icon: <TbList aria-hidden size={16} strokeWidth={1.9} />,
    },
    {
      id: "toolbar-task-checklist",
      label: "Checklist",
      icon: <TbListCheck aria-hidden size={16} strokeWidth={1.9} />,
    },
    {
      id: "toolbar-task-status",
      label: "Status",
      icon: <TbCircleHalf2 aria-hidden size={16} strokeWidth={1.9} />,
      children: statusValues.map((status) => {
        const StatusIcon = statusIcons[status];
        return {
          id: `toolbar-task-status:${status}`,
          label: statusMeta[status].label,
          icon: <StatusIcon aria-hidden size={16} strokeWidth={1.9} />,
        };
      }),
    },
  ];

  const handleFormattingToolbarAction = (item: DropdownItem): void => {
    switch (item.id) {
      case "toolbar-format-bold":
        editor.chain().focus().toggleBold().run();
        return;
      case "toolbar-format-italic":
        editor.chain().focus().toggleItalic().run();
        return;
      case "toolbar-format-underline":
        editor.chain().focus().toggleUnderline().run();
        return;
      case "toolbar-format-strike":
        editor.chain().focus().toggleStrike().run();
        return;
      case "toolbar-format-link":
        setLink();
        return;
      default:
        return;
    }
  };

  const handleTaskToolbarAction = (item: DropdownItem): void => {
    switch (item.id) {
      case "toolbar-task-bullets":
        editor.chain().focus().toggleBulletList().run();
        return;
      case "toolbar-task-checklist":
        editor.chain().focus().toggleTaskList().run();
        return;
      default:
        break;
    }

    if (!item.id.startsWith("toolbar-task-status:")) {
      return;
    }

    const status = item.id.replace("toolbar-task-status:", "");
    if (!statusValues.includes(status as StatusValue)) {
      return;
    }

    applyTaskStatus(editor, status as StatusValue);
  };

  return (
    <div
      ref={wrapperRef}
      className="relative rounded-xl bg-surface"
      style={nodeStyleVariables}
      data-node-heading-enabled={nodeSettings.heading.enabled
        ? "true"
        : "false"}
      data-node-table-enabled={nodeSettings.table.enabled ? "true" : "false"}
      data-node-callout-enabled={nodeSettings.callout.enabled
        ? "true"
        : "false"}
      data-node-due-date-enabled={nodeSettings.dueDate.enabled
        ? "true"
        : "false"}
      data-node-tabs-block-enabled={nodeSettings.tabsBlock.enabled
        ? "true"
        : "false"}
      data-node-nested-page-enabled={nodeSettings.nestedPage.enabled
        ? "true"
        : "false"}
      data-node-code-block-enabled={nodeSettings.codeBlock.enabled
        ? "true"
        : "false"}
      data-node-variable-enabled={nodeSettings.variableField.enabled
        ? "true"
        : "false"}
      data-code-syntax-theme={nodeSettings.codeBlock.syntaxTheme}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        {showHeadingControls
          ? (
            <Menu.Root>
              <Menu.Trigger
                className={[
                  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-fg shadow-soft transition hover:bg-surface-2",
                  toolbarState.activeHeadingLevel ? "bg-surface-2" : "",
                ].join(" ")}
                aria-label="Headings"
                title="Headings"
              >
                <TbHeading aria-hidden size={16} strokeWidth={1.9} />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner side="bottom" align="start" sideOffset={8}>
                  <Menu.Popup className="z-50 min-w-44 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-elevated">
                    {[
                      { level: 1 as const, label: "Heading 1", Icon: TbH1 },
                      { level: 2 as const, label: "Heading 2", Icon: TbH2 },
                      { level: 3 as const, label: "Heading 3", Icon: TbH3 },
                    ].map(({ level, label, Icon }) => (
                      <Menu.Item
                        key={level}
                        onClick={() =>
                          editor.chain().focus().toggleHeading({ level }).run()}
                        className={[
                          "flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium transition",
                          toolbarState.activeHeadingLevel === level
                            ? "bg-accent text-accent-contrast"
                            : "text-fg data-[highlighted]:bg-surface-2",
                        ].join(" ")}
                      >
                        <Icon aria-hidden size={16} strokeWidth={1.9} />
                        {label}
                      </Menu.Item>
                    ))}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          )
          : null}

        {compactToolbar
          ? (
            <CustomDropdown
              label="Formatting"
              items={formattingDropdownItems}
              triggerBare
              triggerAriaLabel="Formatting"
              triggerClassName={[
                toolbarDropdownTriggerClass,
                formattingToolbarActive ? "bg-surface-2" : "",
              ].join(" ")}
              triggerContent={
                <TbBold aria-hidden size={16} strokeWidth={1.9} />
              }
              onAction={handleFormattingToolbarAction}
            />
          )
          : (
            <div className={toolbarGroupClass}>
              <button
                type="button"
                className={[
                  toolbarGroupButtonClass,
                  toolbarState.bold ? toolbarGroupButtonActiveClass : "",
                ].join(" ")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                aria-label="Bold"
                title="Bold"
              >
                <TbBold aria-hidden size={16} strokeWidth={2} />
              </button>
              <button
                type="button"
                className={[
                  toolbarGroupButtonClass,
                  toolbarState.italic ? toolbarGroupButtonActiveClass : "",
                ].join(" ")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                aria-label="Italic"
                title="Italic"
              >
                <TbItalic aria-hidden size={16} strokeWidth={2} />
              </button>
              <button
                type="button"
                className={[
                  toolbarGroupButtonClass,
                  toolbarState.underline ? toolbarGroupButtonActiveClass : "",
                ].join(" ")}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                aria-label="Underline"
                title="Underline"
              >
                <TbUnderline aria-hidden size={16} strokeWidth={2} />
              </button>
              <button
                type="button"
                className={[
                  toolbarGroupButtonClass,
                  toolbarState.strike ? toolbarGroupButtonActiveClass : "",
                ].join(" ")}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                aria-label="Strikethrough"
                title="Strikethrough"
              >
                <TbStrikethrough aria-hidden size={16} strokeWidth={2} />
              </button>
              <div className="mx-1 h-5 w-px bg-border" />
              <button
                type="button"
                className={[
                  toolbarGroupButtonClass,
                  toolbarState.link ? toolbarGroupButtonActiveClass : "",
                ].join(" ")}
                onClick={setLink}
                aria-label="Link"
                title="Link"
              >
                <TbLink aria-hidden size={16} strokeWidth={2} />
              </button>
            </div>
          )}

        <div className="h-6 w-px bg-border" />

        {compactToolbar
          ? (
            <CustomDropdown
              label="Tasks"
              items={taskDropdownItems}
              triggerBare
              triggerAriaLabel="Tasks"
              triggerClassName={[
                toolbarDropdownTriggerClass,
                taskToolbarActive ? "bg-surface-2" : "",
              ].join(" ")}
              triggerContent={
                <TbListCheck aria-hidden size={16} strokeWidth={1.9} />
              }
              onAction={handleTaskToolbarAction}
            />
          )
          : (
            <div className={toolbarGroupClass}>
              <button
                type="button"
                className={[
                  toolbarGroupButtonClass,
                  toolbarState.bulletList ? toolbarGroupButtonActiveClass : "",
                ].join(" ")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                aria-label="Bullets"
                title="Bullets"
              >
                <TbList aria-hidden size={16} strokeWidth={2} />
              </button>
              <button
                type="button"
                className={[
                  toolbarGroupButtonClass,
                  toolbarState.taskList ? toolbarGroupButtonActiveClass : "",
                ].join(" ")}
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                aria-label="Checklist"
                title="Checklist"
              >
                <TbListCheck aria-hidden size={16} strokeWidth={2} />
              </button>
              <Menu.Root>
                <Menu.Trigger
                  className={[
                    toolbarGroupButtonClass,
                    toolbarState.taskItem ? toolbarGroupButtonActiveClass : "",
                  ].join(" ")}
                  aria-label="Status"
                  title="Status"
                >
                  <TbCircleHalf2 aria-hidden size={16} strokeWidth={2} />
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner side="bottom" align="start" sideOffset={8}>
                    <Menu.Popup className="z-50 min-w-56 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-elevated">
                      {statusValues.map((status) => {
                        const StatusIcon = statusIcons[status];

                        return (
                          <Menu.Item
                            key={status}
                            onClick={() => applyTaskStatus(editor, status)}
                            className={[
                              "grid gap-0.5 rounded-md px-2.5 py-2 text-left transition",
                              toolbarState.activeTaskStatus === status
                                ? "bg-accent text-accent-contrast"
                                : "text-fg data-[highlighted]:bg-surface-2",
                            ].join(" ")}
                          >
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <StatusIcon
                                aria-hidden
                                size={16}
                                strokeWidth={1.9}
                              />
                              {statusMeta[status].label}
                            </span>
                            <span
                              className={[
                                "text-xs",
                                toolbarState.activeTaskStatus === status
                                  ? "text-accent-contrast/80"
                                  : "text-muted",
                              ].join(" ")}
                            >
                              {statusMeta[status].hint}
                            </span>
                          </Menu.Item>
                        );
                      })}
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </div>
          )}

        {showBlockInsertGroup
          ? (
            <>
              <div className="h-6 w-px bg-border" />
              <div className={toolbarGroupClass}>
                {nodeSettings.codeBlock.enabled
                  ? (
                    <button
                      type="button"
                      className={[
                        toolbarGroupButtonClass,
                        toolbarState.codeBlock
                          ? toolbarGroupButtonActiveClass
                          : "",
                      ].join(" ")}
                      onClick={() =>
                        editor.chain().focus().toggleCodeBlock().run()}
                      aria-label="Code block"
                      title="Code block"
                    >
                      <TbCode aria-hidden size={16} strokeWidth={2} />
                    </button>
                  )
                  : null}
                {nodeSettings.table.enabled
                  ? (
                    <button
                      type="button"
                      className={[
                        toolbarGroupButtonClass,
                        toolbarState.table ? toolbarGroupButtonActiveClass : "",
                      ].join(" ")}
                      onClick={() =>
                        toolbarState.table
                          ? editor.chain().focus().deleteTable().run()
                          : editor.chain().focus().insertTable({
                            rows: 3,
                            cols: 3,
                            withHeaderRow: true,
                          }).run()}
                      aria-label="Table"
                      title="Table"
                    >
                      <TbTable aria-hidden size={16} strokeWidth={2} />
                    </button>
                  )
                  : null}
                {nodeSettings.callout.enabled
                  ? (
                    <button
                      type="button"
                      className={[
                        toolbarGroupButtonClass,
                        toolbarState.callout
                          ? toolbarGroupButtonActiveClass
                          : "",
                      ].join(" ")}
                      onClick={() =>
                        editor.chain().focus().toggleWrap("callout").run()}
                      aria-label="Callout"
                      title="Callout"
                    >
                      <TbAlertCircle aria-hidden size={16} strokeWidth={2} />
                    </button>
                  )
                  : null}
              </div>
            </>
          )
          : null}

        {showDueDateControls
          ? (
            <>
              <div className="h-6 w-px bg-border" />
              <div className={toolbarGroupClass}>
                <button
                  type="button"
                  className={[
                    toolbarGroupButtonClass,
                    toolbarState.dueDate ? toolbarGroupButtonActiveClass : "",
                  ].join(" ")}
                  onClick={() =>
                    toolbarState.dueDate
                      ? editor.chain().focus().unsetDueDate().run()
                      : editor.chain().focus().wrapWithDueDate().run()}
                  aria-label="Due date"
                  title="Due date"
                >
                  <TbCalendarDue aria-hidden size={16} strokeWidth={2} />
                </button>
              </div>
            </>
          )
          : null}

        {showLayoutControls
          ? (
            <>
              <div className="h-6 w-px bg-border" />
              <div className={toolbarGroupClass}>
                {nodeSettings.tabsBlock.enabled
                  ? (
                    <button
                      type="button"
                      className={[
                        toolbarGroupButtonClass,
                        toolbarState.tabsBlock
                          ? toolbarGroupButtonActiveClass
                          : "",
                      ].join(" ")}
                      onClick={() =>
                        editor.chain().focus().insertTabsBlock().run()}
                      aria-label="Tabs"
                      title="Tabs"
                    >
                      <TbColumns2 aria-hidden size={16} strokeWidth={2} />
                    </button>
                  )
                  : null}
                {nodeSettings.nestedPage.enabled
                  ? (
                    <button
                      type="button"
                      className={[
                        toolbarGroupButtonClass,
                        toolbarState.nestedPage
                          ? toolbarGroupButtonActiveClass
                          : "",
                      ].join(" ")}
                      onClick={() =>
                        editor.chain().focus().insertNestedPage().run()}
                      aria-label="Nested page"
                      title="Nested page"
                    >
                      <TbLink aria-hidden size={16} strokeWidth={2} />
                    </button>
                  )
                  : null}
              </div>
            </>
          )
          : null}

        <div className="ml-auto flex items-center">
          {nodeSettings.variableField.enabled
            ? (
              <Drawer.Root
                open={variableDrawerOpen}
                onOpenChange={setVariableDrawerOpen}
              >
                <Drawer.Trigger
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-fg shadow-soft transition hover:bg-surface-2"
                  aria-label="Variables"
                  title="Variables"
                >
                  <TbVariable aria-hidden size={16} strokeWidth={1.9} />
                </Drawer.Trigger>

                <Drawer.Portal>
                  <Drawer.Backdrop className="fixed inset-0 z-40 bg-fg/30 backdrop-blur-[1px]" />
                  <Drawer.Popup className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto border-l border-border bg-surface p-4 shadow-elevated">
                    <div className="flex items-center justify-between">
                      <Drawer.Title className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                        Variables
                      </Drawer.Title>
                      <Drawer.Close className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-fg transition hover:bg-surface-2">
                        Close
                      </Drawer.Close>
                    </div>

                    <p className="mt-3 text-sm text-muted">
                      Add document variables, insert them with{" "}
                      <code>/</code>, and double-click tokens in the note to
                      edit values in place.
                    </p>

                    <div className="mt-4 grid gap-3">
                      {variableDefinitions.length === 0
                        ? (
                          <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
                            No variables yet. Add one below, then type{" "}
                            <code>/</code> in the note to insert it.
                          </p>
                        )
                        : null}
                      {variableDefinitions.map((definition) => {
                        const resolution = resolveVariable(definition);

                        return (
                          <section
                            key={definition.id}
                            className="grid gap-2 rounded-md border border-border bg-surface p-3"
                          >
                            <div className="grid gap-1">
                              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                                Label
                              </label>
                              <input
                                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-2 focus-visible:ring-ring/25"
                                value={definition.label}
                                onChange={(event) =>
                                  updateVariableDefinition(definition.id, {
                                    label: event.target.value,
                                  })}
                              />
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                                  Placeholder
                                </span>
                                <input
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-2 focus-visible:ring-ring/25"
                                  value={definition.placeholder}
                                  onChange={(event) =>
                                    updateVariableDefinition(definition.id, {
                                      placeholder: event.target.value,
                                    })}
                                />
                              </label>
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                                  Default Value
                                </span>
                                <input
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-2 focus-visible:ring-ring/25"
                                  value={definition.defaultValue}
                                  onChange={(event) =>
                                    updateVariableDefinition(definition.id, {
                                      defaultValue: event.target.value,
                                    })}
                                />
                              </label>
                            </div>

                            <label className="grid gap-1">
                              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                                Current Value
                              </span>
                              <input
                                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-2 focus-visible:ring-ring/25"
                                value={definition.value}
                                onChange={(event) =>
                                  updateVariableDefinition(definition.id, {
                                    value: event.target.value,
                                  })}
                                placeholder={resolution.state === "set"
                                  ? undefined
                                  : resolution.displayValue}
                              />
                            </label>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg transition hover:bg-surface-2"
                                onClick={() =>
                                  insertVariableFromDrawer(definition.id)}
                              >
                                <TbVariablePlus aria-hidden size={14} />
                                Insert
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg transition hover:bg-surface-2"
                                onClick={() =>
                                  updateVariableDefinition(definition.id, {
                                    value: "",
                                  })}
                              >
                                Unset value
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg transition hover:bg-surface-2"
                                onClick={() =>
                                  removeVariableDefinition(definition.id)}
                              >
                                <TbVariableOff aria-hidden size={14} />
                                Remove variable
                              </button>
                            </div>
                          </section>
                        );
                      })}
                    </div>

                    <section className="mt-4 grid gap-2 rounded-md border border-border bg-surface-2 p-3">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                        Add Variable
                      </h3>
                      <label className="grid gap-1">
                        <span className="text-xs text-muted">Label</span>
                        <input
                          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-2 focus-visible:ring-ring/25"
                          value={newVariableLabel}
                          onChange={(event) =>
                            setNewVariableLabel(event.target.value)}
                          placeholder="Client Name"
                        />
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-1">
                          <span className="text-xs text-muted">
                            Placeholder
                          </span>
                          <input
                            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-2 focus-visible:ring-ring/25"
                            value={newVariablePlaceholder}
                            onChange={(event) =>
                              setNewVariablePlaceholder(event.target.value)}
                            placeholder="Your name"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs text-muted">
                            Default value
                          </span>
                          <input
                            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-2 focus-visible:ring-ring/25"
                            value={newVariableDefaultValue}
                            onChange={(event) =>
                              setNewVariableDefaultValue(event.target.value)}
                            placeholder="English"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg transition hover:bg-surface-2"
                        onClick={addVariableDefinition}
                      >
                        <TbVariablePlus aria-hidden size={16} />
                        Add variable
                      </button>
                    </section>
                  </Drawer.Popup>
                </Drawer.Portal>
              </Drawer.Root>
            )
            : null}

          <div className="ml-3 flex items-center gap-2">
            <CustomDropdown
              label="Share"
              items={shareDropdownItems}
              triggerBare
              triggerAriaLabel="Share"
              triggerClassName="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-fg shadow-soft transition hover:bg-surface-2"
              triggerContent={
                <TbShare2 aria-hidden size={16} strokeWidth={1.9} />
              }
              onAction={(item) => {
                if (item.id === "share-download-html") {
                  void downloadExportHtml();
                  return;
                }

                if (item.id === "share-copy-html") {
                  void copyExportHtml();
                  return;
                }

                if (item.id === "share-download-text") {
                  downloadExportText();
                  return;
                }

                if (item.id === "share-copy-text") {
                  void copyExportText();
                  return;
                }

                if (item.id === "share-download-markdown") {
                  downloadExportMarkdown();
                  return;
                }

                if (item.id === "share-copy-markdown") {
                  void copyExportMarkdown();
                  return;
                }

                if (item.id === "share-download-json") {
                  downloadExportJson();
                  return;
                }

                if (item.id === "share-copy-json") {
                  void copyExportJson();
                }
              }}
            />

            <Dialog.Root>
              <Dialog.Trigger
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-fg shadow-soft transition hover:bg-surface-2"
                aria-label="Editor settings"
                title="Editor settings"
              >
                <TbSettings aria-hidden size={16} strokeWidth={1.9} />
              </Dialog.Trigger>

              <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-40 bg-fg/30 backdrop-blur-[1px] transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
                <Dialog.Viewport className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
                  <Dialog.Popup className="my-auto w-full max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-elevated outline-none transition-all duration-150 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 sm:max-h-[calc(100dvh-3rem)] sm:p-5">
                    <div className="flex items-center justify-between">
                      <Dialog.Title className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                        Editor Settings
                      </Dialog.Title>
                      <Dialog.Close className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-fg transition hover:bg-surface-2">
                        Close
                      </Dialog.Close>
                    </div>
                    <Dialog.Description className="mt-2 text-sm text-muted">
                      A popup that opens on top of the entire page.
                    </Dialog.Description>

                    <div className="mt-4 grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
                      <aside className="h-fit rounded-md border border-border bg-surface-2 p-2">
                        <nav className="grid gap-1">
                          <button
                            type="button"
                            className={[
                              "w-full rounded-md px-2.5 py-2 text-left text-sm font-medium transition",
                              activeSettingsSection === "general"
                                ? "border border-accent/30 bg-accent/10 text-fg"
                                : "border border-transparent text-muted hover:bg-surface",
                            ].join(" ")}
                            onClick={() => setActiveSettingsSection("general")}
                          >
                            General
                          </button>
                          <button
                            type="button"
                            className={[
                              "w-full rounded-md px-2.5 py-2 text-left text-sm font-medium transition",
                              activeSettingsSection === "appearance"
                                ? "border border-accent/30 bg-accent/10 text-fg"
                                : "border border-transparent text-muted hover:bg-surface",
                            ].join(" ")}
                            onClick={() =>
                              setActiveSettingsSection("appearance")}
                          >
                            Appearance
                          </button>
                        </nav>
                      </aside>

                      <div className="min-w-0">
                        {activeSettingsSection === "general"
                          ? (
                            <div className="grid gap-4">
                              <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-fg">
                                Use seed sample
                                <Switch.Root
                                  checked={useSampleNote}
                                  onCheckedChange={onUseSampleNoteChange}
                                  aria-label="Load seed sample note"
                                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-surface p-0.5 shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25 data-[checked]:border-accent data-[checked]:bg-accent/20"
                                >
                                  <Switch.Thumb className="h-5 w-5 rounded-full border border-border bg-surface shadow-soft transition-transform duration-200 data-[checked]:translate-x-5" />
                                </Switch.Root>
                              </label>

                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Color Mode
                                </span>
                                <select
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                  value={mode}
                                  onChange={(event) =>
                                    onModeChange(event.target.value as Mode)}
                                >
                                  <option value="system">System</option>
                                  <option value="light">Light</option>
                                  <option value="dark">Dark</option>
                                </select>
                              </label>

                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Background Range
                                </span>
                                <select
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                  value={bgPalette}
                                  onChange={(event) =>
                                    onBgPaletteChange(
                                      event.target.value as BgPalette,
                                    )}
                                >
                                  <option value="white">White</option>
                                  <option value="mist">Mist</option>
                                  <option value="stone">Stone</option>
                                  <option value="slate">Slate</option>
                                  <option value="sand">Sand</option>
                                  <option value="dune">Dune</option>
                                  <option value="bluegray">Blue Gray</option>
                                  <option value="graphite">Graphite</option>
                                  <option value="ink">Ink</option>
                                </select>
                              </label>

                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Color Palette
                                </span>
                                <select
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                  value={palette}
                                  onChange={(event) => onPaletteChange(
                                    event.target.value as Palette,
                                  )}
                                >
                                  <option value="sage">Sage</option>
                                  <option value="ocean">Ocean</option>
                                  <option value="rose">Rose</option>
                                  <option value="clay">Clay</option>
                                  <option value="moss">Moss</option>
                                  <option value="slate">Slate</option>
                                  <option value="indigo">Indigo</option>
                                  <option value="violet">Violet</option>
                                  <option value="sky">Sky</option>
                                  <option value="amber">Amber</option>
                                  <option value="fuchsia">Fuchsia</option>
                                  <option value="neutral">Neutral</option>
                                </select>
                              </label>

                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Accent Color
                                </span>
                                <select
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                  value={accentColor}
                                  onChange={(event) => onAccentColorChange(
                                    event.target.value as AccentColor,
                                  )}
                                >
                                  <option value="coral">Coral</option>
                                  <option value="emerald">Emerald</option>
                                  <option value="indigo">Indigo</option>
                                  <option value="sky">Sky</option>
                                  <option value="violet">Violet</option>
                                  <option value="rose">Rose</option>
                                  <option value="teal">Teal</option>
                                  <option value="amber">Amber</option>
                                  <option value="lime">Lime</option>
                                  <option value="slate">Slate</option>
                                  <option value="plum">Plum</option>
                                  <option value="mint">Mint</option>
                                </select>
                              </label>

                              <div className="grid gap-2 rounded-md border border-border bg-surface-2 p-3">
                                <span className="text-sm font-medium text-fg">
                                  Variable Highlighting
                                </span>
                                <label className="flex items-center justify-between gap-3 text-sm text-fg">
                                  Highlight all variables
                                  <Switch.Root
                                    checked={highlightAllVariables}
                                    onCheckedChange={setHighlightAllVariables}
                                    disabled={!nodeSettings.variableField
                                      .enabled}
                                    aria-label="Highlight all variables"
                                    className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-surface p-0.5 shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25 data-[checked]:border-accent data-[checked]:bg-accent/20"
                                  >
                                    <Switch.Thumb className="h-5 w-5 rounded-full border border-border bg-surface shadow-soft transition-transform duration-200 data-[checked]:translate-x-5" />
                                  </Switch.Root>
                                </label>
                                <label className="flex items-center justify-between gap-3 text-sm text-fg">
                                  Highlight not-set variables (includes
                                  placeholders)
                                  <Switch.Root
                                    checked={highlightUnsetVariables}
                                    onCheckedChange={setHighlightUnsetVariables}
                                    disabled={!nodeSettings.variableField
                                      .enabled}
                                    aria-label="Highlight not-set variables"
                                    className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-surface p-0.5 shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25 data-[checked]:border-accent data-[checked]:bg-accent/20"
                                  >
                                    <Switch.Thumb className="h-5 w-5 rounded-full border border-border bg-surface shadow-soft transition-transform duration-200 data-[checked]:translate-x-5" />
                                  </Switch.Root>
                                </label>
                              </div>

                              <div className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Success
                                </span>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <select
                                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                    value={alertSuccessTone}
                                    onChange={(event) =>
                                      onAlertSuccessToneChange(
                                        event.target.value as AlertTone,
                                      )}
                                  >
                                    <option value="accent">Accent</option>
                                    <option value="background">
                                      Background
                                    </option>
                                    <option value="green">Green</option>
                                    <option value="mint">Mint</option>
                                    <option value="teal">Teal</option>
                                    <option value="blue">Blue</option>
                                    <option value="sky">Sky</option>
                                    <option value="violet">Violet</option>
                                    <option value="amber">Amber</option>
                                    <option value="orange">Orange</option>
                                    <option value="rose">Rose</option>
                                    <option value="red">Red</option>
                                    <option value="slate">Slate</option>
                                  </select>
                                  <select
                                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                    value={alertSuccessStrength}
                                    onChange={(event) =>
                                      onAlertSuccessStrengthChange(
                                        event.target.value as AlertStrength,
                                      )}
                                  >
                                    <option value="subtle">Subtle</option>
                                    <option value="muted">Muted</option>
                                    <option value="strong">Strong</option>
                                  </select>
                                </div>
                              </div>

                              <div className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Info
                                </span>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <select
                                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                    value={alertInfoTone}
                                    onChange={(event) => onAlertInfoToneChange(
                                      event.target.value as AlertTone,
                                    )}
                                  >
                                    <option value="background">
                                      Background
                                    </option>
                                    <option value="accent">Accent</option>
                                    <option value="green">Green</option>
                                    <option value="mint">Mint</option>
                                    <option value="teal">Teal</option>
                                    <option value="blue">Blue</option>
                                    <option value="sky">Sky</option>
                                    <option value="violet">Violet</option>
                                    <option value="amber">Amber</option>
                                    <option value="orange">Orange</option>
                                    <option value="rose">Rose</option>
                                    <option value="red">Red</option>
                                    <option value="slate">Slate</option>
                                  </select>
                                  <select
                                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                    value={alertInfoStrength}
                                    onChange={(event) =>
                                      onAlertInfoStrengthChange(
                                        event.target.value as AlertStrength,
                                      )}
                                  >
                                    <option value="subtle">Subtle</option>
                                    <option value="muted">Muted</option>
                                    <option value="strong">Strong</option>
                                  </select>
                                </div>
                              </div>

                              <div className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Warning
                                </span>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <select
                                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                    value={alertWarningTone}
                                    onChange={(event) =>
                                      onAlertWarningToneChange(
                                        event.target.value as AlertTone,
                                      )}
                                  >
                                    <option value="accent">Accent</option>
                                    <option value="background">
                                      Background
                                    </option>
                                    <option value="green">Green</option>
                                    <option value="mint">Mint</option>
                                    <option value="teal">Teal</option>
                                    <option value="blue">Blue</option>
                                    <option value="sky">Sky</option>
                                    <option value="violet">Violet</option>
                                    <option value="amber">Amber</option>
                                    <option value="orange">Orange</option>
                                    <option value="rose">Rose</option>
                                    <option value="red">Red</option>
                                    <option value="slate">Slate</option>
                                  </select>
                                  <select
                                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                    value={alertWarningStrength}
                                    onChange={(event) =>
                                      onAlertWarningStrengthChange(
                                        event.target.value as AlertStrength,
                                      )}
                                  >
                                    <option value="subtle">Subtle</option>
                                    <option value="muted">Muted</option>
                                    <option value="strong">Strong</option>
                                  </select>
                                </div>
                              </div>

                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Danger Color
                                </span>
                                <select
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                  value={alertDangerTone}
                                  onChange={(event) => onAlertDangerToneChange(
                                    event.target.value as AlertTone,
                                  )}
                                >
                                  <option value="accent">Accent</option>
                                  <option value="green">Green</option>
                                  <option value="mint">Mint</option>
                                  <option value="teal">Teal</option>
                                  <option value="blue">Blue</option>
                                  <option value="sky">Sky</option>
                                  <option value="violet">Violet</option>
                                  <option value="amber">Amber</option>
                                  <option value="orange">Orange</option>
                                  <option value="rose">Rose</option>
                                  <option value="red">Red</option>
                                  <option value="slate">Slate</option>
                                </select>
                              </label>

                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Body Font
                                </span>
                                <select
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                  value={bodyFont}
                                  onChange={(event) => onBodyFontChange(
                                    event.target.value as BodyFont,
                                  )}
                                >
                                  <option value="lexend">Lexend Deca</option>
                                  <option value="mono">JetBrains Mono</option>
                                </select>
                              </label>

                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Heading Font
                                </span>
                                <select
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                  value={headingFont}
                                  onChange={(event) => onHeadingFontChange(
                                    event.target.value as HeadingFont,
                                  )}
                                >
                                  <option value="lexend">Lexend Deca</option>
                                  <option value="mono">JetBrains Mono</option>
                                </select>
                              </label>

                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Font Size
                                </span>
                                <select
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                  value={fontScale}
                                  onChange={(event) => onFontScaleChange(
                                    event.target.value as FontScale,
                                  )}
                                >
                                  <option value="smaller">Smaller</option>
                                  <option value="regular">Regular</option>
                                  <option value="larger">Larger</option>
                                </select>
                              </label>

                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Corner Style
                                </span>
                                <select
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                  value={radius}
                                  onChange={(event) => onRadiusChange(
                                    event.target.value as RadiusPack,
                                  )}
                                >
                                  <option value="none">None</option>
                                  <option value="sharp">Sharp</option>
                                  <option value="soft">Soft</option>
                                  <option value="pill">Pill</option>
                                </select>
                              </label>

                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Elevation
                                </span>
                                <select
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                  value={elevation}
                                  onChange={(event) =>
                                    onElevationChange(
                                      event.target.value as ElevationPack,
                                    )}
                                >
                                  <option value="flat">Flat</option>
                                  <option value="subtle">Subtle</option>
                                  <option value="dramatic">Dramatic</option>
                                </select>
                              </label>

                              <button
                                type="button"
                                className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-fg transition hover:bg-surface-2"
                                onClick={onResetAppearance}
                              >
                                Reset to defaults
                              </button>
                            </div>
                          )
                          : (
                            <section className="grid gap-4 rounded-md border border-border bg-surface-2 p-4">
                              <label className="grid gap-2">
                                <span className="text-sm font-medium text-fg">
                                  Node Type
                                </span>
                                <select
                                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                  value={selectedSettingsNodeType}
                                  onChange={(event) =>
                                    setSelectedSettingsNodeType(
                                      event.target.value as SettingsNodeType,
                                    )}
                                >
                                  {settingsNodeTypeOptions.map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-fg">
                                Enable {selectedSettingsNodeLabel}
                                <Switch.Root
                                  checked={nodeSettings[
                                    selectedSettingsNodeType
                                  ]
                                    .enabled}
                                  onCheckedChange={(enabled) =>
                                    setNodeSettings((previous) => ({
                                      ...previous,
                                      [selectedSettingsNodeType]: {
                                        ...previous[selectedSettingsNodeType],
                                        enabled,
                                      },
                                    }))}
                                  aria-label={`Enable ${selectedSettingsNodeLabel}`}
                                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-surface p-0.5 shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25 data-[checked]:border-accent data-[checked]:bg-accent/20"
                                >
                                  <Switch.Thumb className="h-5 w-5 rounded-full border border-border bg-surface shadow-soft transition-transform duration-200 data-[checked]:translate-x-5" />
                                </Switch.Root>
                              </label>

                              {selectedSettingsNodeType === "table"
                                ? (
                                  <div className="grid gap-2">
                                    <span className="text-sm font-medium text-fg">
                                      Table Header Background
                                    </span>
                                    <select
                                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                      value={isTokenColorValue(
                                          nodeSettings.table.headerBgColor,
                                        )
                                        ? nodeSettings.table.headerBgColor
                                        : "custom"}
                                      onChange={(event) =>
                                        setNodeSettings((previous) => ({
                                          ...previous,
                                          table: {
                                            ...previous.table,
                                            headerBgColor:
                                              event.target.value ===
                                                  "custom"
                                                ? "#eef2f7"
                                                : event.target.value,
                                          },
                                        }))}
                                    >
                                      {nodeColorTokenOptions.map((option) => (
                                        <option
                                          key={option.value}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </option>
                                      ))}
                                      <option value="custom">Custom</option>
                                    </select>
                                    <input
                                      type="color"
                                      className="h-10 w-full rounded-md border border-border bg-surface px-2 py-1 shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                      value={isTokenColorValue(
                                          nodeSettings.table.headerBgColor,
                                        )
                                        ? "#eef2f7"
                                        : nodeSettings.table.headerBgColor}
                                      onChange={(event) =>
                                        setNodeSettings((previous) => ({
                                          ...previous,
                                          table: {
                                            ...previous.table,
                                            headerBgColor: event.target.value,
                                          },
                                        }))}
                                    />
                                  </div>
                                )
                                : null}

                              {selectedSettingsNodeType === "callout"
                                ? (
                                  <>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-medium text-fg">
                                        Callout Background
                                      </span>
                                      <select
                                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                        value={isTokenColorValue(
                                            nodeSettings.callout
                                              .backgroundColor,
                                          )
                                          ? nodeSettings.callout.backgroundColor
                                          : "custom"}
                                        onChange={(event) =>
                                          setNodeSettings((previous) => ({
                                            ...previous,
                                            callout: {
                                              ...previous.callout,
                                              backgroundColor:
                                                event.target.value === "custom"
                                                  ? "#eef2f7"
                                                  : event.target.value,
                                            },
                                          }))}
                                      >
                                        {nodeColorTokenOptions.map((option) => (
                                          <option
                                            key={option.value}
                                            value={option.value}
                                          >
                                            {option.label}
                                          </option>
                                        ))}
                                        <option value="custom">Custom</option>
                                      </select>
                                      <input
                                        type="color"
                                        className="h-10 w-full rounded-md border border-border bg-surface px-2 py-1 shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                        value={isTokenColorValue(
                                            nodeSettings.callout
                                              .backgroundColor,
                                          )
                                          ? "#eef2f7"
                                          : nodeSettings.callout
                                            .backgroundColor}
                                        onChange={(event) =>
                                          setNodeSettings((previous) => ({
                                            ...previous,
                                            callout: {
                                              ...previous.callout,
                                              backgroundColor:
                                                event.target.value,
                                            },
                                          }))}
                                      />
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-medium text-fg">
                                        Callout Border
                                      </span>
                                      <select
                                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                        value={isTokenColorValue(
                                            nodeSettings.callout.borderColor,
                                          )
                                          ? nodeSettings.callout.borderColor
                                          : "custom"}
                                        onChange={(event) =>
                                          setNodeSettings((previous) => ({
                                            ...previous,
                                            callout: {
                                              ...previous.callout,
                                              borderColor:
                                                event.target.value === "custom"
                                                  ? "#6366f1"
                                                  : event.target.value,
                                            },
                                          }))}
                                      >
                                        {nodeColorTokenOptions.map((option) => (
                                          <option
                                            key={option.value}
                                            value={option.value}
                                          >
                                            {option.label}
                                          </option>
                                        ))}
                                        <option value="custom">Custom</option>
                                      </select>
                                      <input
                                        type="color"
                                        className="h-10 w-full rounded-md border border-border bg-surface px-2 py-1 shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                        value={isTokenColorValue(
                                            nodeSettings.callout.borderColor,
                                          )
                                          ? "#6366f1"
                                          : nodeSettings.callout.borderColor}
                                        onChange={(event) =>
                                          setNodeSettings((previous) => ({
                                            ...previous,
                                            callout: {
                                              ...previous.callout,
                                              borderColor: event.target.value,
                                            },
                                          }))}
                                      />
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-medium text-fg">
                                        Callout Font Color
                                      </span>
                                      <select
                                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                        value={isTokenColorValue(
                                            nodeSettings.callout.fontColor,
                                          )
                                          ? nodeSettings.callout.fontColor
                                          : "custom"}
                                        onChange={(event) =>
                                          setNodeSettings((previous) => ({
                                            ...previous,
                                            callout: {
                                              ...previous.callout,
                                              fontColor: event.target.value ===
                                                  "custom"
                                                ? "#1f2937"
                                                : event.target.value,
                                            },
                                          }))}
                                      >
                                        {nodeColorTokenOptions.map((option) => (
                                          <option
                                            key={option.value}
                                            value={option.value}
                                          >
                                            {option.label}
                                          </option>
                                        ))}
                                        <option value="custom">Custom</option>
                                      </select>
                                      <input
                                        type="color"
                                        className="h-10 w-full rounded-md border border-border bg-surface px-2 py-1 shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                        value={isTokenColorValue(
                                            nodeSettings.callout.fontColor,
                                          )
                                          ? "#1f2937"
                                          : nodeSettings.callout.fontColor}
                                        onChange={(event) =>
                                          setNodeSettings((previous) => ({
                                            ...previous,
                                            callout: {
                                              ...previous.callout,
                                              fontColor: event.target.value,
                                            },
                                          }))}
                                      />
                                    </label>
                                  </>
                                )
                                : null}

                              {selectedSettingsNodeType === "codeBlock"
                                ? (
                                  <div className="grid gap-3">
                                    <label className="grid gap-2">
                                      <span className="text-sm font-medium text-fg">
                                        Code Syntax Theme
                                      </span>
                                      <select
                                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                        value={nodeSettings.codeBlock
                                          .syntaxTheme}
                                        onChange={(event) =>
                                          setNodeSettings((previous) => ({
                                            ...previous,
                                            codeBlock: {
                                              ...previous.codeBlock,
                                              syntaxTheme: event.target
                                                .value as CodeBlockSyntaxTheme,
                                            },
                                          }))}
                                      >
                                        {codeBlockSyntaxThemeOptions.map((
                                          option,
                                        ) => (
                                          <option
                                            key={option.value}
                                            value={option.value}
                                          >
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    {codeBlockColorFieldOptions.map((field) => (
                                      <label
                                        key={field.key}
                                        className="grid gap-2"
                                      >
                                        <span className="text-sm font-medium text-fg">
                                          {field.label}
                                        </span>
                                        <select
                                          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                          value={isTokenColorValue(
                                              nodeSettings.codeBlock[field.key],
                                            )
                                            ? nodeSettings.codeBlock[field.key]
                                            : "custom"}
                                          onChange={(event) =>
                                            setNodeSettings((previous) => ({
                                              ...previous,
                                              codeBlock: {
                                                ...previous.codeBlock,
                                                [field.key]:
                                                  event.target.value ===
                                                      "custom"
                                                    ? field.fallback
                                                    : event.target.value,
                                              },
                                            }))}
                                        >
                                          {nodeColorTokenOptions.map((
                                            option,
                                          ) => (
                                            <option
                                              key={option.value}
                                              value={option.value}
                                            >
                                              {option.label}
                                            </option>
                                          ))}
                                          <option value="custom">Custom</option>
                                        </select>
                                        <input
                                          type="color"
                                          className="h-10 w-full rounded-md border border-border bg-surface px-2 py-1 shadow-soft outline-none transition focus-visible:ring-4 focus-visible:ring-ring/25"
                                          value={colorInputValue(
                                            nodeSettings.codeBlock[field.key],
                                            field.fallback,
                                          )}
                                          onChange={(event) =>
                                            setNodeSettings((previous) => ({
                                              ...previous,
                                              codeBlock: {
                                                ...previous.codeBlock,
                                                [field.key]: event.target.value,
                                              },
                                            }))}
                                        />
                                      </label>
                                    ))}
                                  </div>
                                )
                                : null}

                              {selectedSettingsNodeType !== "table" &&
                                  selectedSettingsNodeType !== "callout" &&
                                  selectedSettingsNodeType !== "codeBlock"
                                ? (
                                  <p className="text-sm text-muted">
                                    No extra style controls yet for{" "}
                                    <span className="font-medium text-fg">
                                      {selectedSettingsNodeLabel}
                                    </span>.
                                  </p>
                                )
                                : null}

                              <p className="text-xs text-muted">
                                Disabled node types fall back to raw
                                markdown-like display and are removed from
                                toolbar/slash insertion commands.
                              </p>
                            </section>
                          )}
                      </div>
                    </div>
                  </Dialog.Popup>
                </Dialog.Viewport>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>
      </div>

      <div
        className="note-editor-shell p-4"
        data-highlight-variables={highlightAllVariables ? "true" : "false"}
        data-highlight-unset={highlightUnsetVariables ? "true" : "false"}
        data-code-syntax-theme={nodeSettings.codeBlock.syntaxTheme}
      >
        <EditorContent editor={editor} />
      </div>

      {nodeSettings.variableField.enabled && variableValuePopover &&
          activePopoverDefinition
        ? (
          <div
            ref={variablePopoverRef}
            className="note-variable-popover editor-inline-popover absolute z-60 w-[17.5rem]"
            style={{
              left: variableValuePopover.left,
              top: variableValuePopover.top,
            }}
          >
            <p className="editor-inline-popover-title">
              {activePopoverDefinition.label}
            </p>
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submitVariableValuePopover();
              }}
            >
              <input
                ref={variablePopoverInputRef}
                className="editor-inline-popover-input"
                value={variableValuePopover.draftValue}
                onChange={(event) =>
                  setVariableValuePopover((previous) =>
                    previous
                      ? { ...previous, draftValue: event.target.value }
                      : previous
                  )}
                placeholder={resolveVariable(activePopoverDefinition)
                  .displayValue}
              />
              <div className="editor-inline-popover-actions">
                <button
                  type="button"
                  className="editor-inline-popover-btn"
                  onClick={() => setVariableValuePopover(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="editor-inline-popover-btn"
                  onClick={unsetFromVariableValuePopover}
                >
                  Unset
                </button>
                <button
                  type="submit"
                  className="editor-inline-popover-btn editor-inline-popover-btn-primary"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        )
        : null}

      <CustomDropdown
        label="Slash Commands"
        items={slashDropdownItems}
        open={Boolean(slashContext) && slashDropdownItems.length > 0}
        rootClassName="contents"
        triggerBare
        onOpenChange={(open) => {
          if (!open) {
            setSlashContext(null);
            setActiveSlashIndex(0);
          }
        }}
        triggerClassName="pointer-events-none absolute h-px w-px border-0 p-0 opacity-0"
        triggerStyle={{
          left: slashContext?.left ?? 0,
          top: slashContext?.top ?? 0,
        }}
        onAction={(item) => {
          if (!slashContext) {
            return;
          }

          const command = slashCommandById.get(item.id);
          if (!command) {
            return;
          }

          editor.chain().focus().deleteRange(slashContext).run();
          command.run(editor);
          setSlashContext(null);
          setActiveSlashIndex(0);
        }}
      />
    </div>
  );
}
