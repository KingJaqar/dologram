/**
 * Markdown spike screen — dev tools only (EXPO_PUBLIC_DG_DEV_TOOLS === "1").
 * Records the M2-06 spike result: each input renders as literal text,
 * no images load, no errors are thrown.
 * Phase 3 Step 5.
 */
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { textStyle } from '../../src/theme/typography';
import { TopBar } from '../../src/components/TopBar';
import { MessageText } from '../../src/components/MessageText';

// Dev tools guard (D-160)
/** M2-06 spike inputs */
const SPIKE_INPUTS = [
  { label: 'XSS script tag (must render as literal text)', input: '<script>alert(1)</script>' },
  { label: 'HTML bold tag (must render as literal text)', input: '<b>x</b>' },
  { label: 'Unclosed strong (must not crash)', input: '**unclosed' },
  { label: 'Unbalanced link (must not crash)', input: '[a](b' },
  { label: 'Heading (rendered as plain text)', input: '# Heading' },
  { label: 'Image (alt text only, no image rendered)', input: '![alt text](https://example.com/x.png)' },
  { label: 'Block quote (plain text)', input: '> This is a quote' },
  { label: 'Bullet list (plain text)', input: '- item one\n- item two\n- item three' },
  { label: 'Table (plain text)', input: '| Col A | Col B |\n|---|---|\n| 1 | 2 |' },
  { label: 'Bold and italic', input: 'This is **bold** and _italic_ text.' },
  { label: 'Inline code', input: 'Use `console.log()` to debug.' },
  { label: 'Fenced code block', input: '```\nfunction hello() {\n  return "world";\n}\n```' },
];

export default function MarkdownSpikeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;

  // Dev tools guard (D-160) — hooks called first, redirect rendered conditionally
  if (process.env.EXPO_PUBLIC_DG_DEV_TOOLS !== '1') {
    return <Redirect href="/(main)/(tabs)" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg.app }}>
      <TopBar title="Markdown spike (M2-06)" />
      <ScrollView
        contentContainerStyle={{
          padding: theme.space[4],
          gap: theme.space[4],
          paddingBottom: insets.bottom + theme.space[4],
        }}
      >
        {SPIKE_INPUTS.map(({ label, input }) => (
          <View
            key={label}
            style={{
              borderWidth: 1,
              borderColor: c.separator,
              borderRadius: theme.radius.md,
              padding: theme.space[3],
              gap: theme.space[2],
            }}
          >
            <Text
              style={[textStyle(theme.typeTokens.labelMd), { color: c.text.secondary }]}
              maxFontSizeMultiplier={1.5}
            >
              {label}
            </Text>
            <Text
              style={[textStyle(theme.typeTokens.mono), { color: c.text.muted, marginBottom: 4 }]}
            >
              {input}
            </Text>
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: c.separator,
                paddingTop: theme.space[2],
              }}
            >
              <MessageText content={input} color={c.text.primary} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
