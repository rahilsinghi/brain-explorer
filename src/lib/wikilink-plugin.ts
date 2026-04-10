import type { Plugin } from "unified";
import type { Root, Text, PhrasingContent } from "mdast";
import { visit } from "unist-util-visit";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function extractWikilinks(text: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(WIKILINK_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    links.push(match[1]);
  }
  return links;
}

export function wikilinkToSlug(link: string): string {
  return link.endsWith(".md") ? link : `${link}.md`;
}

export const remarkWikilinks: Plugin<
  [{ onWikilinkClick?: (slug: string) => void }],
  Root
> =
  (options = {}) =>
  (tree) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || index === undefined) return;

      const value = node.value;
      const re = new RegExp(WIKILINK_RE.source, "g");
      let match: RegExpExecArray | null;
      let lastIndex = 0;
      const children: PhrasingContent[] = [];

      while ((match = re.exec(value)) !== null) {
        if (match.index > lastIndex) {
          children.push({
            type: "text",
            value: value.slice(lastIndex, match.index),
          });
        }
        const slug = match[1];
        const displayText = match[2] || slug.split("/").pop() || slug;
        children.push({
          type: "html",
          value: `<span class="wikilink" data-slug="${wikilinkToSlug(slug)}">${displayText}</span>`,
        } as unknown as PhrasingContent);
        lastIndex = re.lastIndex;
      }

      if (children.length > 0) {
        if (lastIndex < value.length) {
          children.push({ type: "text", value: value.slice(lastIndex) });
        }
        parent.children.splice(index, 1, ...children);
      }
    });
  };
