/**
 * Token preview screen — dev tools only (EXPO_PUBLIC_DG_DEV_TOOLS === "1").
 * Shows swatches of every color token, every type token, every MVP icon,
 * and a Light / Dark / System selector.
 * Phase 2 Step 8 (D-160).
 */
import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  color,
  avatarFills,
  typeTokens,
  iconNames,
} from '@dologram/shared';
import type { TypeTokenKey } from '@dologram/shared';
import { useTheme } from '../../src/theme/ThemeProvider';
import type { ThemeSetting } from '../../src/theme/ThemeProvider';
import { textStyle, fontFamilies } from '../../src/theme/typography';
import { Icon } from '../../src/components/Icon';
import { TopBar } from '../../src/components/TopBar';
import { goBackOrReplace } from '../../src/navigation/goBackOrReplace';

// Dev tools guard (D-160)
// The guard is checked after all hook calls.

const TYPE_TOKEN_KEYS = Object.keys(typeTokens) as TypeTokenKey[];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: theme.space[6] }}>
      <Text
        style={[
          textStyle(theme.typeTokens.titleMd),
          { color: theme.colors.text.primary, marginBottom: theme.space[3] },
        ]}
        maxFontSizeMultiplier={1.5}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function ColorSwatch({ name, hex }: { name: string; hex: string }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.swatchRow}>
      <View
        style={[
          styles.swatch,
          {
            backgroundColor: hex,
            borderColor: c.separator,
            borderRadius: theme.radius.sm,
          },
        ]}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={[textStyle(theme.typeTokens.labelMd), { color: c.text.primary }]}
          maxFontSizeMultiplier={1.5}
        >
          {name}
        </Text>
        <Text
          style={[textStyle(theme.typeTokens.bodySm), { color: c.text.muted }]}
          maxFontSizeMultiplier={1.5}
        >
          {hex}
        </Text>
      </View>
    </View>
  );
}

function TypographySample({ tokenKey }: { tokenKey: TypeTokenKey }) {
  const theme = useTheme();
  const token = theme.typeTokens[tokenKey];
  const c = theme.colors;
  // Map family+weight to an installed font family name
  let fontFamily: string = fontFamilies.Inter_400Regular;
  if (token.family === 'JetBrains Mono') {
    fontFamily = fontFamilies.JetBrainsMono_400Regular;
  } else if (token.weight === 700) {
    fontFamily = fontFamilies.Inter_700Bold;
  } else if (token.weight === 600) {
    fontFamily = fontFamilies.Inter_600SemiBold;
  } else if (token.weight === 500) {
    fontFamily = fontFamilies.Inter_500Medium;
  }

  return (
    <View style={{ marginBottom: theme.space[2] }}>
      <Text
        style={{
          fontFamily,
          fontSize: token.size,
          lineHeight: token.lineHeight,
          letterSpacing: token.letterSpacing,
          color: c.text.primary,
        }}
        maxFontSizeMultiplier={1.5}
      >
        {`${tokenKey} — The quick brown fox`}
      </Text>
      <Text
        style={[textStyle(theme.typeTokens.bodySm), { color: c.text.muted }]}
      >
        {`${token.family} ${token.weight} / ${token.size}px / ${token.lineHeight}lh`}
      </Text>
    </View>
  );
}

function IconSample({ semanticName }: { semanticName: string }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.iconRow}>
      <Icon name={semanticName} size="md" color={c.text.primary} accessibilityLabel={semanticName} />
      <Text
        style={[textStyle(theme.typeTokens.bodySm), { color: c.text.secondary, flex: 1 }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.5}
      >
        {semanticName}
      </Text>
    </View>
  );
}

// ─── Theme picker ─────────────────────────────────────────────────────────────

function ThemePicker() {
  const theme = useTheme();
  const c = theme.colors;
  const options: ThemeSetting[] = ['system', 'light', 'dark'];

  return (
    <View style={{ flexDirection: 'row', gap: theme.space[2], marginBottom: theme.space[4] }}>
      {options.map((opt) => {
        const active = theme.setting === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => theme.setSetting(opt)}
            style={[
              styles.themeBtn,
              {
                backgroundColor: active ? c.brand.primary : c.bg.surface,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.space[3],
                paddingVertical: theme.space[2],
              },
            ]}
            accessibilityRole="radio"
            accessibilityLabel={`Theme: ${opt}`}
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                textStyle(theme.typeTokens.labelLg),
                { color: active ? c.text.inverse : c.text.primary },
              ]}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Color section ────────────────────────────────────────────────────────────

function buildColorEntries(scheme: 'light' | 'dark'): { name: string; hex: string }[] {
  const palette = color[scheme];
  const entries: { name: string; hex: string }[] = [];

  function walk(obj: Record<string, unknown>, prefix: string) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') {
        entries.push({ name: key, hex: v });
      } else if (typeof v === 'object' && v !== null) {
        walk(v as Record<string, unknown>, key);
      }
    }
  }

  walk(palette as unknown as Record<string, unknown>, '');
  return entries;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TokensScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = theme.colors;
  const [tab, setTab] = useState<'colors' | 'type' | 'icons'>('colors');

  // Dev tools guard — hooks called first (D-160)
  if (process.env.EXPO_PUBLIC_DG_DEV_TOOLS !== '1') {
    return <Redirect href="/(main)/(tabs)" />;
  }

  const colorEntries = buildColorEntries(theme.scheme);
  const iconEntries = Object.keys(iconNames);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg.app }}>
      <TopBar
        title="Token preview"
        onBack={() => goBackOrReplace(router, '/(main)/(tabs)/settings')}
      />

      {/* Tab switcher */}
      <View
        style={[
          styles.tabRow,
          {
            backgroundColor: c.bg.chatList,
            borderBottomColor: c.separator,
          },
        ]}
      >
        {(['colors', 'type', 'icons'] as const).map((t) => {
          const active = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[
                styles.tabBtn,
                { borderBottomColor: active ? c.brand.primary : 'transparent' },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.charAt(0).toUpperCase() + t.slice(1)}
            >
              <Text
                style={[
                  textStyle(theme.typeTokens.labelLg),
                  { color: active ? c.brand.primary : c.text.secondary },
                ]}
                maxFontSizeMultiplier={1.5}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'colors' && (
        <FlatList
          data={colorEntries}
          keyExtractor={(item) => item.name}
          renderItem={({ item }) => <ColorSwatch name={item.name} hex={item.hex} />}
          contentContainerStyle={{
            padding: theme.space[4],
            paddingBottom: insets.bottom + theme.space[4],
          }}
          ListHeaderComponent={<ThemePicker />}
          ListFooterComponent={
            <Section title="Avatar fills">
              {avatarFills.map((fill, i) => (
                <ColorSwatch key={fill} name={`avatarFill[${i}]`} hex={fill} />
              ))}
            </Section>
          }
        />
      )}

      {tab === 'type' && (
        <ScrollView
          contentContainerStyle={{
            padding: theme.space[4],
            paddingBottom: insets.bottom + theme.space[4],
          }}
        >
          <Section title="Typography tokens">
            {TYPE_TOKEN_KEYS.map((key) => (
              <TypographySample key={key} tokenKey={key} />
            ))}
          </Section>
        </ScrollView>
      )}

      {tab === 'icons' && (
        <FlatList
          data={iconEntries}
          keyExtractor={(item) => item}
          renderItem={({ item }) => <IconSample semanticName={item} />}
          numColumns={2}
          columnWrapperStyle={{ gap: theme.space[1] }}
          contentContainerStyle={{
            padding: theme.space[4],
            paddingBottom: insets.bottom + theme.space[4],
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  swatch: {
    width: 40,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
  },
  themeBtn: {
    alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flex: 1,
  },
});
