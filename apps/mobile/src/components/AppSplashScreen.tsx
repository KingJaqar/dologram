import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** Matches the native splash while fonts and the stored account initialize. */
export function AppSplashScreen() {
  const { colors, scheme } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg.app }]} accessible accessibilityLabel="DoloGram">
      <Image
        source={scheme === 'dark'
          ? require('../../assets/logo/dologram_splash_dark.png')
          : require('../../assets/logo/dologram_splash_light.png')}
        style={styles.artwork}
        resizeMode="contain"
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  artwork: { width: 240, height: 240 },
});
