/**
 * MessageText — renders chat message content using react-native-markdown-display.
 * M2-06, D-05, D-30, D-99, 3.2 Text formatting, 5.5 Markdown safety.
 *
 * Rules:
 * - HTML tags are never executed (html: false).
 * - Images never render — alt text is shown as plain text instead (D-99).
 * - Only http/https/mailto/tel links are opened (M2-06).
 * - Block-level elements (headings, blockquote, hr, table) are rendered as
 *   plain text so layout stays predictable in chat bubbles.
 * - inline code and fenced blocks use the mono token.
 * - Bold uses Inter_700Bold, italic uses Inter_400Regular + italic style.
 * - Search highlights are computed once over the rendered text, so a term that spans
 *   inline leaves (for example `nee**dle**`) still highlights as one contiguous match.
 *   Hidden Markdown syntax and link destinations are never highlighted.
 *
 * Assumption A-08: react-native-markdown-display 7.0.2 renders on SDK 57.
 * Fallback: switch to react-native-marked (PR-10) and apply the same rules.
 */
import React, { useMemo } from 'react';
import { Text } from 'react-native';
import Markdown, { MarkdownIt, parser } from 'react-native-markdown-display';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle, fontFamilies } from '../theme/typography';
import type { ASTNode, RenderRules } from 'react-native-markdown-display';
import { memoizedHighlightRanges, type HighlightRange } from '../search/matching';

// Singleton markdown-it instance — no HTML, no linkify, no typographer (D-05)
const markdownIt = new MarkdownIt({ html: false, linkify: false, typographer: false });

/** Separates rendered blocks so a match cannot span two paragraphs. */
const BLOCK_SEPARATOR = '\u0000';

/** Node types this renderer collapses to their plain rendered text. */
const PLAIN_BLOCK_TYPES = new Set([
  'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6',
  'blockquote', 'bullet_list', 'ordered_list', 'list_item', 'table',
]);

/** Node types that start a new block of rendered text. */
const BLOCK_LEAF_TYPES = new Set([...PLAIN_BLOCK_TYPES, 'fence', 'hr']);

/** Returns the plain text of all descendant text tokens. */
function plainText(node: ASTNode): string {
  if (node.content) return node.content;
  if (node.children && node.children.length > 0) {
    return node.children.map(plainText).join('');
  }
  return '';
}

/** Rendered text for a node this renderer draws as a single text leaf, or null for containers. */
function leafText(node: ASTNode): string | null {
  if (PLAIN_BLOCK_TYPES.has(node.type)) return plainText(node);
  switch (node.type) {
    case 'text':
    case 'code_inline':
    case 'fence':
      return node.content;
    case 'image':
      return (node.attributes.alt as string | undefined) ?? '';
    case 'hr':
      return '---';
    default:
      return null;
  }
}

/** Stable identity for a node across the two parses of the same content. */
function nodePath(node: ASTNode, parents: readonly ASTNode[]): string {
  const parts: string[] = [];
  for (let index = parents.length - 1; index >= 0; index--) {
    const parent = parents[index];
    if (parent.type === 'body') continue; // Synthetic root added by the renderer.
    parts.push(`${parent.type}:${parent.tokenIndex}`);
  }
  parts.push(`${node.type}:${node.tokenIndex}`);
  return parts.join('/');
}

type HighlightSource = { text: string; offsets: Map<string, HighlightRange> };

function collectLeaves(nodes: readonly ASTNode[], parents: ASTNode[], source: HighlightSource): void {
  for (const node of nodes) {
    const text = leafText(node);
    if (text !== null) {
      if (BLOCK_LEAF_TYPES.has(node.type)) source.text += BLOCK_SEPARATOR;
      const start = source.text.length;
      source.text += text;
      source.offsets.set(nodePath(node, parents), { start, end: source.text.length });
      if (BLOCK_LEAF_TYPES.has(node.type)) source.text += BLOCK_SEPARATOR;
      continue;
    }
    const block = node.type === 'paragraph';
    if (block) source.text += BLOCK_SEPARATOR;
    // Parents are collected nearest-first so they match the renderer's `parentNodes` argument.
    collectLeaves(node.children ?? [], [node, ...parents], source);
    if (block) source.text += BLOCK_SEPARATOR;
  }
}

function buildHighlightSource(content: string): HighlightSource {
  const source: HighlightSource = { text: '', offsets: new Map() };
  const tree = parser(
    content,
    ((root: ASTNode) => root) as unknown as Parameters<typeof parser>[1],
    markdownIt,
  ) as ASTNode[];
  collectLeaves(tree, [], source);
  return source;
}

/** Query ranges clipped to one rendered leaf, relative to that leaf's text. */
function leafRanges(source: HighlightSource, ranges: readonly HighlightRange[], path: string): HighlightRange[] {
  const span = source.offsets.get(path);
  if (!span) return [];
  const slices: HighlightRange[] = [];
  for (const range of ranges) {
    const start = Math.max(range.start, span.start);
    const end = Math.min(range.end, span.end);
    if (end > start) slices.push({ start: start - span.start, end: end - span.start });
  }
  return slices;
}

function highlightedParts(text: string, ranges: readonly HighlightRange[], highlightColor: string, inverseColor: string): React.ReactNode[] {
  if (ranges.length === 0) return [text];
  const parts: React.ReactNode[] = [];
  let offset = 0;
  for (const range of ranges) {
    if (range.start > offset) parts.push(text.slice(offset, range.start));
    parts.push(<Text key={`${range.start}-${range.end}`} style={{ backgroundColor: highlightColor, color: inverseColor }}>{text.slice(range.start, range.end)}</Text>);
    offset = range.end;
  }
  if (offset < text.length) parts.push(text.slice(offset));
  return parts;
}

/** Allowed URL schemes for link press (M2-06). */
function isAllowedUrl(url: string): boolean {
  return (
    url.startsWith('http:') ||
    url.startsWith('https:') ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:')
  );
}

export interface MessageTextProps {
  content: string;
  /** Text color. */
  color?: string;
  /** Optional search query to highlight in visible Markdown text. */
  highlightQuery?: string;
}

export function MessageText({ content, color, highlightQuery }: MessageTextProps) {
  const theme = useTheme();
  const c = theme.colors;
  const textColor = color ?? c.text.primary;
  const bodyStyle = textStyle(theme.typeTokens.bodyLg);
  const highlightEnabled = Boolean(highlightQuery);

  const source = useMemo(
    () => (highlightEnabled ? buildHighlightSource(content) : null),
    [content, highlightEnabled],
  );
  const ranges = useMemo(
    () => (source && highlightQuery ? memoizedHighlightRanges(source.text, highlightQuery) : []),
    [highlightQuery, source],
  );

  const parts = (node: ASTNode, parents: readonly ASTNode[], text: string): React.ReactNode[] => {
    if (!source || ranges.length === 0) return [text];
    const path = nodePath(node, parents);
    // Unknown leaf shape: keep the per-leaf behaviour instead of highlighting the wrong characters.
    const slices = source.offsets.has(path) ? leafRanges(source, ranges, path) : memoizedHighlightRanges(text, highlightQuery ?? '');
    return highlightedParts(text, slices, c.brand.primary, c.text.inverse);
  };

  const rules: RenderRules = {
    // Block-level: render plain text only
    heading1: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, plainText(node))}
      </Text>
    ),
    heading2: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, plainText(node))}
      </Text>
    ),
    heading3: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, plainText(node))}
      </Text>
    ),
    heading4: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, plainText(node))}
      </Text>
    ),
    heading5: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, plainText(node))}
      </Text>
    ),
    heading6: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, plainText(node))}
      </Text>
    ),
    blockquote: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, plainText(node))}
      </Text>
    ),
    bullet_list: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, plainText(node))}
      </Text>
    ),
    ordered_list: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, plainText(node))}
      </Text>
    ),
    list_item: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, plainText(node))}
      </Text>
    ),
    table: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, plainText(node))}
      </Text>
    ),
    hr: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, '---')}
      </Text>
    ),

    // Image: render alt text only, never load a remote image (D-99)
    image: (node, _children, parents) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {parts(node, parents, (node.attributes['alt'] as string | undefined) ?? '')}
      </Text>
    ),

    // Inline code — mono token
    code_inline: (node, _children, parents) => (
      <Text
        key={node.key}
        style={{
          ...textStyle(theme.typeTokens.mono),
          color: textColor,
          backgroundColor: c.bg.input,
        }}
      >
        {parts(node, parents, node.content)}
      </Text>
    ),

    // Fenced code block — mono token
    fence: (node, _children, parents) => (
      <Text
        key={node.key}
        style={{
          ...textStyle(theme.typeTokens.mono),
          color: textColor,
          backgroundColor: c.bg.input,
        }}
      >
        {parts(node, parents, node.content)}
      </Text>
    ),

    // Bold — Inter_700Bold
    strong: (_node, children) => (
      <Text
        key={_node.key}
        style={{ fontFamily: fontFamilies.Inter_700Bold, color: textColor }}
      >
        {children}
      </Text>
    ),

    // Italic — regular weight + italic style
    em: (_node, children) => (
      <Text
        key={_node.key}
        style={{ fontFamily: fontFamilies.Inter_400Regular, fontStyle: 'italic', color: textColor }}
      >
        {children}
      </Text>
    ),

    text: (node, _children, parents, styles, inheritedStyles = {}) => (
      <Text key={node.key} style={[inheritedStyles, styles.text]}>
        {parts(node, parents, node.content)}
      </Text>
    ),
  };

  const markdownStyles = {
    body: { ...bodyStyle, color: textColor },
    paragraph: { marginTop: 0, marginBottom: 0 },
    text: { ...bodyStyle, color: textColor },
  };

  return (
    <Markdown
      rules={rules}
      style={markdownStyles}
      markdownit={markdownIt}
      onLinkPress={(url) => isAllowedUrl(url)}
    >
      {content}
    </Markdown>
  );
}
