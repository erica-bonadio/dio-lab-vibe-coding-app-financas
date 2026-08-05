import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChatMessage } from '@shared/types';
import { CATEGORY_LABELS, INVESTMENT_KIND_LABELS } from '@shared/types';
import {
  contributeInvestment,
  getBudgetStatuses,
  getMonthSummary,
  getPortfolioTotals,
  insertChatMessage,
  insertTransaction,
  listChatMessages,
  listGoals,
  redeemInvestment,
} from '@/db/repositories';
import { buildAgentTips, helpText } from '@/features/agent/tips';
import { parseChatIntent } from '@/features/chat/parseTransaction';
import { currentYearMonth } from '@/lib/id';
import { formatBRL } from '@/lib/money';
import { colors, spacing } from '@/theme/colors';
import { fontStyle } from '@/theme/typography';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    const list = await listChatMessages();
    if (list.length === 0) {
      const welcome = await insertChatMessage({
        role: 'assistant',
        content:
          'Oi! Sou o Capim. Conta um gasto ou receita em linguagem natural — eu registro e categorizo.',
        linkedTransactionId: null,
      });
      setMessages([welcome]);
      return;
    }
    setMessages(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function reply(content: string, linkedTransactionId: string | null = null) {
    const msg = await insertChatMessage({
      role: 'assistant',
      content,
      linkedTransactionId,
    });
    setMessages((prev) => [...prev, msg]);
  }

  async function onSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      const userMsg = await insertChatMessage({
        role: 'user',
        content: text,
        linkedTransactionId: null,
      });
      setMessages((prev) => [...prev, userMsg]);

      const intent = parseChatIntent(text);

      if (intent.kind === 'help') {
        await reply(helpText());
        return;
      }

      if (intent.kind === 'summary') {
        const ym = currentYearMonth();
        const [summary, goals, portfolio, budgets] = await Promise.all([
          getMonthSummary(ym),
          listGoals(),
          getPortfolioTotals(),
          getBudgetStatuses(ym),
        ]);
        const lines = [
          `Resumo ${summary.yearMonth}:`,
          `Entradas ${formatBRL(summary.incomeCents)}`,
          `Saídas ${formatBRL(summary.expenseCents)}`,
          `Saldo ${formatBRL(summary.balanceCents)}`,
          `Carteira ${formatBRL(portfolio.currentCents)} (resultado ${formatBRL(portfolio.gainCents)})`,
          '',
          ...buildAgentTips(summary, goals, portfolio.currentCents, budgets),
        ];
        await reply(lines.join('\n'));
        return;
      }

      if (intent.kind === 'investment') {
        if (intent.action === 'redeem') {
          const inv = await redeemInvestment({
            name: intent.name,
            amountCents: intent.amountCents,
          });
          if (!inv) {
            await reply(
              `Não achei o ativo "${intent.name}". Cadastre com "investi …" antes.`,
            );
            return;
          }
          await reply(
            `Resgate de ${formatBRL(intent.amountCents)} em ${inv.name}. Atual: ${formatBRL(inv.currentCents)}.`,
          );
          return;
        }
        const inv = await contributeInvestment({
          name: intent.name,
          kind: intent.investmentKind,
          amountCents: intent.amountCents,
        });
        await reply(
          `Aporte de ${formatBRL(intent.amountCents)} em ${inv.name} (${INVESTMENT_KIND_LABELS[inv.kind]}). Carteira do ativo: ${formatBRL(inv.currentCents)}.`,
        );
        return;
      }

      if (intent.kind === 'unknown') {
        await reply(
          'Não entendi o valor. Experimente: "gastei 45 no mercado", "investi 500 no tesouro" ou digite "ajuda".',
        );
        return;
      }

      const tx = await insertTransaction({
        type: intent.type,
        amountCents: intent.amountCents,
        category: intent.category,
        description: intent.description,
        occurredAt: intent.occurredAt,
        source: 'chat',
      });

      const label = CATEGORY_LABELS[intent.category];
      const verb = intent.type === 'income' ? 'Receita' : 'Despesa';
      await reply(
        `${verb} registrada: ${formatBRL(intent.amountCents)} · ${label} — ${intent.description}`,
        tx.id,
      );
    } finally {
      setSending(false);
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true }),
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={8}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Chat</Text>
        <Text style={styles.sub}>Fale o gasto — eu cuido do resto.</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
        renderItem={({ item }) => {
          const mine = item.role === 'user';
          return (
            <View
              style={[
                styles.bubble,
                mine ? styles.bubbleUser : styles.bubbleBot,
              ]}
            >
              <Text style={[styles.bubbleText, mine && styles.bubbleTextUser]}>
                {item.content}
              </Text>
            </View>
          );
        }}
      />

      <View
        style={[
          styles.composer,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder='Ex.: gastei 32 no café'
          placeholderTextColor={colors.inkMuted}
          multiline
          onSubmitEditing={() => void onSend()}
        />
        <Pressable
          style={[styles.send, (!draft.trim() || sending) && styles.sendDisabled]}
          disabled={!draft.trim() || sending}
          onPress={() => void onSend()}
        >
          <Text style={styles.sendText}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.paper,
  },
  title: {
    ...fontStyle('display', 28, { color: colors.accentDark }),
  },
  sub: {
    ...fontStyle('body', 14, { color: colors.inkMuted }),
  },
  list: {
    padding: spacing.md,
    gap: 10,
    flexGrow: 1,
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
  },
  bubbleBot: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    ...fontStyle('body', 15, { color: colors.ink, lineHeight: 22 }),
  },
  bubbleTextUser: {
    color: colors.white,
  },
  composer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.paper,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...fontStyle('body', 15, { color: colors.ink }),
  },
  send: {
    backgroundColor: colors.accentDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sendDisabled: { opacity: 0.45 },
  sendText: {
    ...fontStyle('bodyBold', 14, { color: colors.white }),
  },
});
