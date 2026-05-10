"use client";

import { useEffect, useMemo, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  WidgetType,
  gutterLineClass,
  keymap
} from "@codemirror/view";
import {
  RangeSet,
  StateEffect,
  StateField,
  type Range
} from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

interface SqlEditorProps {
  source: string;
  onChange: (value: string) => void;
  flaggedLines?: number[];
  jumpedLine?: number | null;
  onFormat?: () => void;
}

const setFlaggedLinesEffect = StateEffect.define<number[]>();
const setJumpedLineEffect = StateEffect.define<number | null>();
const setTypingEffect = StateEffect.define<boolean>();

class TypingDotWidget extends WidgetType {
  override toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "editor-typing-dot";
    return span;
  }
  override eq(): boolean {
    return true;
  }
  override ignoreEvent(): boolean {
    return true;
  }
}
const typingDotWidget = new TypingDotWidget();

const typingState = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setTypingEffect)) {
        return effect.value;
      }
    }
    return value;
  },
  provide: (field) =>
    EditorView.decorations.compute([field], (state): DecorationSet => {
      if (!state.field(field)) {
        return Decoration.none;
      }
      return Decoration.set([
        Decoration.widget({ widget: typingDotWidget, side: 1 }).range(
          state.doc.length
        )
      ]);
    })
});

class FlaggedGutterMarker extends GutterMarker {
  override elementClass = "cm-flagged-gutter";
}
const flaggedGutter = new FlaggedGutterMarker();

interface FlagFieldValue {
  flagged: Set<number>;
  jumped: number | null;
}

const flagField = StateField.define<FlagFieldValue>({
  create: () => ({ flagged: new Set<number>(), jumped: null }),
  update(value, tr) {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(setFlaggedLinesEffect)) {
        next = { ...next, flagged: new Set(effect.value) };
      }
      if (effect.is(setJumpedLineEffect)) {
        next = { ...next, jumped: effect.value };
      }
    }
    return next;
  },
  provide: (field) => [
    EditorView.decorations.compute([field], (state): DecorationSet => {
      const { flagged, jumped } = state.field(field);
      if (flagged.size === 0 && jumped == null) {
        return Decoration.none;
      }
      const decos: Range<Decoration>[] = [];
      const totalLines = state.doc.lines;
      for (let line = 1; line <= totalLines; line++) {
        const linePos = state.doc.line(line).from;
        if (flagged.has(line)) {
          decos.push(
            Decoration.line({ class: "cm-flagged-line" }).range(linePos)
          );
        }
        if (jumped === line) {
          decos.push(
            Decoration.line({ class: "cm-jumped-line" }).range(linePos)
          );
        }
      }
      return Decoration.set(decos, true);
    }),
    gutterLineClass.compute([field], (state) => {
      const { flagged } = state.field(field);
      if (flagged.size === 0) {
        return RangeSet.empty;
      }
      const ranges: Range<GutterMarker>[] = [];
      const totalLines = state.doc.lines;
      for (let line = 1; line <= totalLines; line++) {
        if (flagged.has(line)) {
          ranges.push(flaggedGutter.range(state.doc.line(line).from));
        }
      }
      return RangeSet.of(ranges, true);
    })
  ]
});

const designHighlight = HighlightStyle.define([
  // Keywords (CREATE, TABLE, FROM, ...) → pink
  { tag: t.keyword, color: "var(--syntax-keyword)", fontWeight: "500" },
  { tag: t.controlKeyword, color: "var(--syntax-keyword)", fontWeight: "500" },
  { tag: t.modifier, color: "var(--syntax-keyword)", fontWeight: "500" },
  // Types (UUID, TEXT, INTEGER, ...) → blue
  { tag: t.typeName, color: "var(--syntax-type)" },
  { tag: t.standard(t.typeName), color: "var(--syntax-type)" },
  // Strings → green
  { tag: t.string, color: "var(--syntax-string)" },
  { tag: t.special(t.string), color: "var(--syntax-string)" },
  // Numbers and booleans → orange
  { tag: t.number, color: "var(--syntax-number)" },
  { tag: t.bool, color: "var(--syntax-number)" },
  // Comments → muted italic
  {
    tag: t.comment,
    color: "var(--ink-4)",
    fontStyle: "italic"
  },
  { tag: t.lineComment, color: "var(--ink-4)", fontStyle: "italic" },
  { tag: t.blockComment, color: "var(--ink-4)", fontStyle: "italic" },
  // Functions → blue
  { tag: t.function(t.variableName), color: "var(--syntax-type)" },
  { tag: t.function(t.propertyName), color: "var(--syntax-type)" },
  { tag: t.function(t.definition(t.variableName)), color: "var(--syntax-type)" },
  // Punctuation → ink-3
  { tag: t.punctuation, color: "var(--ink-3)" },
  { tag: t.bracket, color: "var(--ink-3)" },
  { tag: t.brace, color: "var(--ink-3)" },
  { tag: t.paren, color: "var(--ink-3)" },
  { tag: t.separator, color: "var(--ink-3)" },
  { tag: t.operator, color: "var(--ink-3)" },
  // Plain identifiers → primary ink
  { tag: t.variableName, color: "var(--ink)" },
  { tag: t.propertyName, color: "var(--ink)" },
  { tag: t.definition(t.variableName), color: "var(--ink)" }
]);

const designTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      color: "var(--ink)",
      backgroundColor: "var(--bg-elev)",
      fontFamily: "var(--font-mono)",
      fontSize: "12.5px"
    },
    "&.cm-focused": {
      outline: "none"
    },
    ".cm-scroller": {
      overflow: "auto",
      color: "var(--ink)",
      backgroundColor: "var(--bg-elev)",
      fontFamily: "var(--font-mono)",
      lineHeight: "22px",
      scrollbarWidth: "thin",
      scrollbarColor: "var(--line-strong) transparent"
    },
    ".cm-scroller::-webkit-scrollbar": {
      width: "10px",
      height: "10px"
    },
    ".cm-scroller::-webkit-scrollbar-thumb": {
      background: "var(--line-strong)",
      borderRadius: "99px",
      border: "3px solid var(--bg)"
    },
    ".cm-content": {
      padding: "14px 16px",
      caretColor: "var(--accent)",
      color: "var(--ink)",
      backgroundColor: "var(--bg-elev)",
      fontFamily: "var(--font-mono)",
      fontSize: "12.5px",
      lineHeight: "22px",
      fontFeatureSettings: '"ss01"',
      letterSpacing: "0"
    },
    ".cm-line": {
      padding: "0 6px",
      margin: "0 -6px",
      borderRadius: "4px"
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--accent)"
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
      {
        backgroundColor: "color-mix(in oklch, var(--accent) 22%, transparent)"
      },
    ".cm-activeLine": {
      backgroundColor: "transparent"
    },
    ".cm-gutters": {
      backgroundColor: "var(--bg-elev)",
      color: "var(--ink-4)",
      borderRight: "1px solid var(--line)",
      fontFamily: "var(--font-mono)",
      fontSize: "11.5px",
      fontVariantNumeric: "tabular-nums"
    },
    ".cm-lineNumbers": {
      minWidth: "44px"
    },
    ".cm-gutterElement": {
      padding: "0 8px 0 0",
      textAlign: "right"
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--ink-3)"
    }
  },
  { dark: true }
);

export function SqlEditor({
  source,
  onChange,
  flaggedLines,
  jumpedLine,
  onFormat
}: SqlEditorProps): React.ReactElement {
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const extensions = useMemo(
    () => [
      sql({ dialect: PostgreSQL, upperCaseKeywords: true }),
      syntaxHighlighting(designHighlight),
      flagField,
      typingState,
      designTheme,
      EditorView.lineWrapping,
      keymap.of([
        {
          key: "Shift-Alt-f",
          preventDefault: true,
          run: () => {
            onFormat?.();
            return true;
          }
        }
      ])
    ],
    [onFormat]
  );

  useEffect(() => {
    const view = editorRef.current?.view;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: setFlaggedLinesEffect.of(flaggedLines ?? [])
    });
  }, [flaggedLines]);

  useEffect(() => {
    const view = editorRef.current?.view;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: setJumpedLineEffect.of(jumpedLine ?? null)
    });

    if (jumpedLine != null && jumpedLine >= 1 && jumpedLine <= view.state.doc.lines) {
      const linePos = view.state.doc.line(jumpedLine).from;
      view.dispatch({
        effects: EditorView.scrollIntoView(linePos, { y: "center" })
      });
    }
  }, [jumpedLine]);

  // Live SQL→canvas typing dot — blinks at end of editor for 1.2 s after the
  // most recent change, then clears. Acts as a visual cue that the parser
  // pipeline is reacting to keystrokes.
  useEffect(() => {
    const view = editorRef.current?.view;
    if (!view) {
      return;
    }
    view.dispatch({ effects: setTypingEffect.of(true) });
    const t = window.setTimeout(() => {
      const v = editorRef.current?.view;
      if (v) {
        v.dispatch({ effects: setTypingEffect.of(false) });
      }
    }, 1200);
    return () => window.clearTimeout(t);
  }, [source]);

  return (
    <CodeMirror
      ref={editorRef}
      value={source}
      onChange={onChange}
      theme="none"
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        autocompletion: true
      }}
      style={{ height: "100%" }}
    />
  );
}
