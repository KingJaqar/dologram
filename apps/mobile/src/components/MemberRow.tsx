/**
 * One member in AND-12 (12.5): 48 avatar, the display name, the role in label.md, and — for the
 * owner of a group — a Remove action on the other members' rows (D-70).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ChatInfoMember } from '@dologram/shared';
import { useTheme } from '../theme/ThemeProvider';
import { textStyle } from '../theme/typography';
import { Avatar } from './Avatar';
import { IconButton } from './Button';

export interface MemberRowProps {
  member: ChatInfoMember;
  /** D-70: only the owner removes members, and never its own row. */
  canRemove: boolean;
  /** Offline, the action is disabled with "No connection" (12.5). */
  disabled?: boolean;
  onRemove: (member: ChatInfoMember) => void;
}

export function MemberRow({ member, canRemove, disabled = false, onRemove }: MemberRowProps) {
  const theme = useTheme();
  const c = theme.colors;
  const showRemove = canRemove && !member.isSelf;

  return (
    <View style={styles.row}>
      <Avatar id={member.userId} displayName={member.displayName} size={48} />

      <View style={styles.text}>
        <Text
          style={[textStyle(theme.typeTokens.bodyLg), { color: c.text.primary }]}
          numberOfLines={1}
        >
          {member.displayName}
        </Text>
        {member.roleLabel ? (
          <Text style={[textStyle(theme.typeTokens.labelMd), { color: c.text.secondary }]}>
            {member.roleLabel}
          </Text>
        ) : null}
      </View>

      {showRemove ? (
        <IconButton
          iconName="action.delete"
          iconSize="sm"
          color={c.error.text}
          accessibilityLabel={`${member.displayName} remove`}
          onPress={() => onRemove(member)}
          disabled={disabled}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: { flex: 1 },
});
