import { Fragment, type ReactNode } from "react";

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul" | "ol"; start: number; items: string[] };

/**
 * Splits a chat reply into paragraphs and lists, using the same rules as the widget's renderRich() in
 * public/embed.js: blank lines split paragraphs, "- ", "* " or "1. " lines become lists, "# " marks are dropped.
 */
function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^#{1,6}\s+/, "");
    if (!line) {
      current = null;
      continue;
    }
    const item = line.match(/^(?:[-*•]|(\d+)[.)])\s+(.*)$/);
    if (item) {
      const kind = item[1] ? "ol" : "ul";
      if (!current || current.kind !== kind) {
        current = { kind, start: item[1] ? Number(item[1]) : 1, items: [] };
        blocks.push(current);
      }
      current.items.push(item[2]);
      continue;
    }
    if (!current || current.kind !== "p") {
      current = { kind: "p", lines: [] };
      blocks.push(current);
    }
    current.lines.push(line);
  }
  return blocks;
}

/** **text** becomes bold; an unclosed "**" (mid-typing) is shown as bold so the markers never flash. */
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+(?:\*\*|$))/)
    .filter(Boolean)
    .map((part, i) =>
      part.startsWith("**") ? (
        <strong key={i} style={{ fontWeight: 650 }}>{part.replace(/^\*\*|\*\*$/g, "")}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}

/** Renders a bot reply with light formatting; `caret` is placed at the end of the text while it types out. */
export function ChatText({ text, caret }: { text: string; caret?: ReactNode }) {
  const blocks = toBlocks(text);
  return (
    <>
      {blocks.map((block, b) => {
        const last = b === blocks.length - 1;
        const gap = b === 0 ? 0 : 8;
        if (block.kind === "p") {
          return (
            <p key={b} style={{ margin: `${gap}px 0 0` }}>
              {block.lines.map((line, l) => (
                <Fragment key={l}>
                  {l > 0 && <br />}
                  {inline(line)}
                </Fragment>
              ))}
              {last && caret}
            </p>
          );
        }
        const List = block.kind;
        return (
          <List key={b} start={block.kind === "ol" && block.start !== 1 ? block.start : undefined}
            style={{ margin: `${b === 0 ? 0 : 6}px 0 0`, paddingLeft: 20, listStyle: block.kind === "ol" ? "decimal" : "disc" }}>
            {block.items.map((item, i) => (
              <li key={i} style={{ margin: "4px 0", paddingLeft: 2 }}>
                {inline(item)}
                {last && i === block.items.length - 1 && caret}
              </li>
            ))}
          </List>
        );
      })}
      {blocks.length === 0 && caret}
    </>
  );
}
