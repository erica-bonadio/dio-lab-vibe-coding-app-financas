import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { CATEGORY_LABELS, type TransactionCategory } from '@shared/types';
import { formatBRL } from '@/lib/money';
import { colors, spacing } from '@/theme/colors';
import { fontStyle } from '@/theme/typography';

/** Paleta alinhada ao Capim (sem roxo). */
const SLICE_COLORS = [
  '#2F6B3A',
  '#1F4A28',
  '#5A8F62',
  '#8A6A2A',
  '#8B3A3A',
  '#3D6B5A',
  '#6B8F4E',
  '#4A6B3A',
  '#A07840',
  '#5A6E5C',
  '#2F5A4A',
  '#7A9B6A',
];

export type PieSlice = {
  key: string;
  label: string;
  valueCents: number;
  color: string;
};

type Props = {
  byCategory: Record<string, number>;
  size?: number;
};

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeSlice(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

export function buildExpenseSlices(
  byCategory: Record<string, number>,
): PieSlice[] {
  return Object.entries(byCategory)
    .filter(([, cents]) => cents > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, valueCents], i) => ({
      key,
      label:
        CATEGORY_LABELS[key as TransactionCategory] ?? key,
      valueCents,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
    }));
}

export function ExpensePieChart({ byCategory, size = 200 }: Props) {
  const slices = useMemo(() => buildExpenseSlices(byCategory), [byCategory]);
  const total = slices.reduce((s, x) => s + x.valueCents, 0);

  if (total <= 0 || slices.length === 0) {
    return (
      <Text style={styles.empty}>
        Sem gastos neste mês para montar o gráfico.
      </Text>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  let angle = 0;

  const paths = slices.map((slice) => {
    const sweep = (slice.valueCents / total) * 360;
    // fatia única: círculo quase completo
    const start = angle;
    const end = angle + Math.max(sweep, 0.5);
    angle = end;
    const d =
      slices.length === 1
        ? describeSlice(cx, cy, r, 0, 359.99)
        : describeSlice(cx, cy, r, start, end);
    return { ...slice, d, pct: Math.round((slice.valueCents / total) * 100) };
  });

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G>
          {paths.map((p) => (
            <Path key={p.key} d={p.d} fill={p.color} />
          ))}
        </G>
      </Svg>
      <View style={styles.legend}>
        {paths.map((p) => (
          <View key={p.key} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: p.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {p.label}
            </Text>
            <Text style={styles.legendValue}>
              {p.pct}% · {formatBRL(p.valueCents)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.md,
  },
  empty: {
    ...fontStyle('body', 14, { color: colors.inkMuted, lineHeight: 20 }),
  },
  legend: {
    alignSelf: 'stretch',
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    flex: 1,
    ...fontStyle('body', 14, { color: colors.ink }),
  },
  legendValue: {
    ...fontStyle('bodyMedium', 13, { color: colors.inkMuted }),
  },
});
