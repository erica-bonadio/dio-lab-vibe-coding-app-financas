import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { currentYearMonth } from '@/lib/id';
import {
  formatYearMonthBr,
  isCurrentMonth,
  shiftYearMonth,
} from '@/lib/month';
import { colors, spacing } from '@/theme/colors';
import { fontStyle } from '@/theme/typography';

type Props = {
  yearMonth: string;
  onChange: (next: string) => void;
};

export function MonthPicker({ yearMonth, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(shiftYearMonth(yearMonth, -1))}
        hitSlop={10}
        accessibilityLabel="Mês anterior"
        style={styles.btn}
      >
        <Ionicons name="chevron-back" size={22} color={colors.accentDark} />
      </Pressable>
      <View style={styles.center}>
        <Text style={styles.label}>{formatYearMonthBr(yearMonth)}</Text>
        {!isCurrentMonth(yearMonth) ? (
          <Pressable onPress={() => onChange(currentYearMonth())}>
            <Text style={styles.today}>voltar ao mês atual</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={() => onChange(shiftYearMonth(yearMonth, 1))}
        hitSlop={10}
        accessibilityLabel="Próximo mês"
        style={styles.btn}
      >
        <Ionicons name="chevron-forward" size={22} color={colors.accentDark} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  btn: {
    padding: 8,
  },
  center: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    ...fontStyle('bodyBold', 16, { color: colors.ink }),
    textTransform: 'capitalize',
  },
  today: {
    ...fontStyle('body', 12, { color: colors.accentDark }),
  },
});
