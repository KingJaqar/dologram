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
 *
 * Assumption A-08: react-native-markdown-display 7.0.2 renders on SDK 57.
 * Fallback: switch to react-native-marked (PR-10) and apply the same rules.
 */
import React from 'react';
import { Text } from 'react-native';
import Markdown, { MarkdownIt } from 'react-native-markdown-display';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle, fontFamilies } from '../theme/typography';
import type { ASTNode, RenderRules } from 'react-native-markdown-display';

// Singleton markdown-it instance — no HTML, no linkify, no typographer (D-05)
const markdownIt = new MarkdownIt({ html: false, linkify: false, typographer: false });

/** Returns the plain text of all descendant text tokens. */
function plainText(node: ASTNode): string {
  if (node.content) return node.content;
  if (node.children && node.children.length > 0) {
    return node.children.map(plainText).join('');
  }
  return '';
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
}

export function MessageText({ content, color }: MessageTextProps) {
  const theme = useTheme();
  const c = theme.colors;
  const textColor = color ?? c.text.primary;
  const bodyStyle = textStyle(theme.typeTokens.bodyLg);

  const rules: RenderRules = {
    // Block-level: render plain text only
    heading1: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {plainText(node)}
      </Text>
    ),
    heading2: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {plainText(node)}
      </Text>
    ),
    heading3: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {plainText(node)}
      </Text>
    ),
    heading4: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {plainText(node)}
      </Text>
    ),
    heading5: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {plainText(node)}
      </Text>
    ),
    heading6: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {plainText(node)}
      </Text>
    ),
    blockquote: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {plainText(node)}
      </Text>
    ),
    bullet_list: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {plainText(node)}
      </Text>
    ),
    ordered_list: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {plainText(node)}
      </Text>
    ),
    list_item: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {plainText(node)}
      </Text>
    ),
    table: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {plainText(node)}
      </Text>
    ),
    hr: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {'---'}
      </Text>
    ),

    // Image: render alt text only, never load a remote image (D-99)
    image: (node) => (
      <Text key={node.key} style={{ ...bodyStyle, color: textColor }}>
        {(node.attributes['alt'] as string | undefined) ?? ''}
      </Text>
    ),

    // Inline code — mono token
    code_inline: (node) => (
      <Text
        key={node.key}
        style={{
          ...textStyle(theme.typeTokens.mono),
          color: textColor,
          backgroundColor: c.bg.input,
        }}
      >
        {node.content}
      </Text>
    ),

    // Fenced code block — mono token
    fence: (node) => (
      <Text
        key={node.key}
        style={{
          ...textStyle(theme.typeTokens.mono),
          color: textColor,
          backgroundColor: c.bg.input,
        }}
      >
        {node.content}
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
