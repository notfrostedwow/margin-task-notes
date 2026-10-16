// Deliberately small Markdown subset. React escapes every text node; no HTML,
// images, URLs, executable content, or parser-generated attributes are inserted.
export function Markdown({ text }: { text: string }) {
  const blocks: {
    type: "heading" | "subheading" | "list" | "quote" | "paragraph";
    lines: string[];
  }[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) {
      blocks.push({ type: "paragraph", lines: [] });
      continue;
    }
    const type = line.startsWith("# ")
      ? "heading"
      : line.startsWith("## ")
        ? "subheading"
        : line.startsWith("- ")
          ? "list"
          : line.startsWith("> ")
            ? "quote"
            : "paragraph";
    const content =
      type === "paragraph" ? line : line.slice(type === "subheading" ? 3 : 2);
    const previous = blocks.at(-1);
    if (previous?.type === type && type !== "heading" && type !== "subheading")
      previous.lines.push(content);
    else blocks.push({ type, lines: [content] });
  }
  return (
    <div className="markdown">
      {blocks
        .filter((b) => b.lines.length)
        .map((block, index) => {
          const content = block.lines.join("\n");
          if (block.type === "list")
            return (
              <ul key={index}>
                {block.lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            );
          if (block.type === "heading") return <h3 key={index}>{content}</h3>;
          if (block.type === "subheading")
            return <h4 key={index}>{content}</h4>;
          if (block.type === "quote")
            return <blockquote key={index}>{content}</blockquote>;
          return <p key={index}>{content}</p>;
        })}
    </div>
  );
}
