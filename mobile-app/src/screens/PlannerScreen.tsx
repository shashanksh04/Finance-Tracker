import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { budgetsApi, goalsApi, billsApi, recurringApi, categoriesApi, accountsApi } from '../services/api';
import { useHaptics } from '../hooks/useHaptics';
import { useOfflineList } from '../hooks/useOfflineData';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';
import { CardSkeleton, ListSkeleton } from '../components/ui/SkeletonLoader';
import AdaptiveSheet from '../components/AdaptiveSheet';
import EmptyState from '../components/ui/EmptyState';
import { formatCurrency, daysUntil } from '../utils/format';
import type { Budget, Goal, Bill, Recurring, Category, Account } from '../types';
import Confetti from '../components/Confetti';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

type PlannerTab = 'budgets' | 'goals' | 'bills' | 'recurring';

const TABS: { key: PlannerTab; label: string; icon: string }[] = [
  { key: 'budgets', label: 'Budgets', icon: '📊' },
  { key: 'goals', label: 'Goals', icon: '🎯' },
  { key: 'bills', label: 'Bills', icon: '📄' },
  { key: 'recurring', label: 'Recurring', icon: '🔄' },
];

export default function PlannerScreen() {
  const { colors } = useTheme();
  const { success: hapticSuccess, light: hapticLight, heavy: hapticHeavy } = useHaptics();
  const [activeTab, setActiveTab] = useState<PlannerTab>('budgets');
  const [refreshing, setRefreshing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Budgets
  const budgetsData = useOfflineList<Budget>(TABLES.BUDGETS, {
    orderBy: 'created_at DESC',
    apiFetch: () => budgetsApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });
  const categoriesData = useOfflineList<Category>(TABLES.CATEGORIES, {
    orderBy: 'name ASC',
    apiFetch: () => categoriesApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  // Goals
  const goalsData = useOfflineList<Goal>(TABLES.GOALS, {
    orderBy: 'target_date ASC',
    apiFetch: () => goalsApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  // Bills
  const billsData = useOfflineList<Bill>(TABLES.BILLS, {
    orderBy: 'due_date ASC',
    apiFetch: () => billsApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  // Recurring
  const recurringData = useOfflineList<Recurring>(TABLES.RECURRING, {
    orderBy: 'created_at DESC',
    apiFetch: () => recurringApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });
  const accountsListData = useOfflineList<Account>(TABLES.ACCOUNTS, {
    apiFetch: () => accountsApi.list(),
    mapApiResponse: (res) => res.data?.items || res.data || [],
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      budgetsData.refresh(), goalsData.refresh(), billsData.refresh(),
      recurringData.refresh(), categoriesData.refresh(), accountsListData.refresh(),
    ]);
    setRefreshing(false);
  };

  // Budget form state
  const [budgetShowModal, setBudgetShowModal] = useState(false);
  const [budgetEditing, setBudgetEditing] = useState<Budget | null>(null);
  const [budgetName, setBudgetName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [budgetCategoryId, setBudgetCategoryId] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);

  // Goal form state
  const [goalShowModal, setGoalShowModal] = useState(false);
  const [goalEditing, setGoalEditing] = useState<Goal | null>(null);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('0');
  const [goalDate, setGoalDate] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);

  // Bill form state
  const [billShowModal, setBillShowModal] = useState(false);
  const [billEditing, setBillEditing] = useState<Bill | null>(null);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDate, setBillDueDate] = useState('');
  const [billRecurrence, setBillRecurrence] = useState('monthly');
  const [billReminder, setBillReminder] = useState('3');
  const [billSaving, setBillSaving] = useState(false);

  // Recurring form state
  const [recShowModal, setRecShowModal] = useState(false);
  const [recEditing, setRecEditing] = useState<Recurring | null>(null);
  const [recAmount, setRecAmount] = useState('');
  const [recDescription, setRecDescription] = useState('');
  const [recType, setRecType] = useState<'expense' | 'income'>('expense');
  const [recAccountId, setRecAccountId] = useState('');
  const [recCategoryId, setRecCategoryId] = useState('');
  const [recFrequency, setRecFrequency] = useState('monthly');
  const [recSaving, setRecSaving] = useState(false);

  const categoryMap = useMemo(() => {
    const m: Record<string, Category> = {};
    categoriesData.data.forEach((c) => { m[c.id] = c; });
    return m;
  }, [categoriesData.data]);

  const accountMap = useMemo(() => {
    const m: Record<string, Account> = {};
    accountsListData.data.forEach((a) => { m[a.id] = a; });
    return m;
  }, [accountsListData.data]);

  // Budget handlers
  const openBudgetCreate = () => {
    setBudgetEditing(null); setBudgetName(''); setBudgetAmount('');
    setBudgetPeriod('monthly'); setBudgetCategoryId(''); setBudgetShowModal(true);
  };
  const openBudgetEdit = (b: Budget) => {
    setBudgetEditing(b); setBudgetName(b.category_name || ''); setBudgetAmount(b.amount.toString());
    setBudgetPeriod(b.period as any); setBudgetCategoryId(b.category_id || ''); setBudgetShowModal(true);
  };
  const handleBudgetSave = async () => {
    if (!budgetAmount || !budgetCategoryId) return;
    setBudgetSaving(true);
    try {
      const data = { amount: parseFloat(budgetAmount), category_id: budgetCategoryId, period: budgetPeriod };
      if (budgetEditing) {
        const res = await budgetsApi.update(budgetEditing.id, data);
        await repository.update(TABLES.BUDGETS, budgetEditing.id, res.data);
      } else {
        const res = await budgetsApi.create(data);
        await repository.create(TABLES.BUDGETS, res.data);
      }
      hapticSuccess(); setBudgetShowModal(false); budgetsData.refresh();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setBudgetSaving(false); }
  };
  const handleBudgetDelete = (id: string) => {
    Alert.alert('Delete Budget', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await budgetsApi.delete(id); await repository.delete(TABLES.BUDGETS, id); budgetsData.refresh(); } },
    ]);
  };

  // Goal handlers
  const openGoalCreate = () => {
    setGoalEditing(null); setGoalName(''); setGoalTarget(''); setGoalCurrent('0');
    const future = new Date(); future.setFullYear(future.getFullYear() + 1);
    setGoalDate(future.toISOString().slice(0, 10)); setGoalShowModal(true);
  };
  const openGoalEdit = (g: Goal) => {
    setGoalEditing(g); setGoalName(g.name); setGoalTarget(g.target_amount.toString());
    setGoalCurrent(g.current_amount.toString()); setGoalDate(g.deadline || ''); setGoalShowModal(true);
  };
  const handleGoalSave = async () => {
    if (!goalName || !goalTarget) return;
    setGoalSaving(true);
    try {
      const data = { name: goalName, target_amount: parseFloat(goalTarget), current_amount: parseFloat(goalCurrent) || 0, deadline: goalDate || undefined };
      if (goalEditing) {
        const res = await goalsApi.update(goalEditing.id, data);
        await repository.update(TABLES.GOALS, goalEditing.id, res.data);
      } else {
        const res = await goalsApi.create(data);
        await repository.create(TABLES.GOALS, res.data);
      }
      hapticSuccess(); setGoalShowModal(false); goalsData.refresh();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setGoalSaving(false); }
  };
  const handleGoalDelete = (id: string) => {
    Alert.alert('Delete Goal', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await goalsApi.delete(id); await repository.delete(TABLES.GOALS, id); goalsData.refresh(); } },
    ]);
  };

  // Bill handlers
  const openBillCreate = () => {
    setBillEditing(null); setBillName(''); setBillAmount(''); setBillDueDate('');
    setBillRecurrence('monthly'); setBillReminder('3'); setBillShowModal(true);
  };
  const openBillEdit = (b: Bill) => {
    setBillEditing(b); setBillName(b.name); setBillAmount(b.amount.toString());
    setBillDueDate(b.due_date); setBillRecurrence(b.recurrence || 'monthly');
    setBillReminder((b.reminder_days_before || 3).toString()); setBillShowModal(true);
  };
  const handleBillSave = async () => {
    if (!billName || !billAmount) return;
    setBillSaving(true);
    try {
      const data = { name: billName, amount: parseFloat(billAmount), due_date: billDueDate, recurrence: billRecurrence, reminder_days_before: parseInt(billReminder) || 3 };
      if (billEditing) {
        const res = await billsApi.update(billEditing.id, data);
        await repository.update(TABLES.BILLS, billEditing.id, res.data);
      } else {
        const res = await billsApi.create(data);
        await repository.create(TABLES.BILLS, res.data);
      }
      hapticSuccess(); setBillShowModal(false); billsData.refresh();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setBillSaving(false); }
  };
  const handleBillDelete = (id: string) => {
    Alert.alert('Delete Bill', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await billsApi.delete(id); await repository.delete(TABLES.BILLS, id); billsData.refresh(); } },
    ]);
  };
  const toggleBillPaid = async (bill: Bill) => {
    try {
      const res = await billsApi.update(bill.id, { is_paid: bill.is_paid ? 0 : 1 });
      await repository.update(TABLES.BILLS, bill.id, res.data);
      billsData.refresh();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
  };

  // Recurring handlers
  const openRecCreate = () => {
    setRecEditing(null); setRecAmount(''); setRecDescription(''); setRecType('expense');
    setRecAccountId(accountsListData.data[0]?.id || '');
    setRecCategoryId(''); setRecFrequency('monthly'); setRecShowModal(true);
  };
  const openRecEdit = (r: Recurring) => {
    setRecEditing(r); setRecAmount(Math.abs(r.amount).toString()); setRecDescription(r.description);
    setRecType(r.type as any); setRecAccountId(r.account_id || '');
    setRecCategoryId(r.category_id || ''); setRecFrequency(r.frequency); setRecShowModal(true);
  };
  const handleRecSave = async () => {
    if (!recAmount || !recAccountId) return;
    setRecSaving(true);
    try {
      const amount = recType === 'expense' ? -Math.abs(parseFloat(recAmount)) : Math.abs(parseFloat(recAmount));
      const data = { amount, description: recDescription, type: recType, account_id: recAccountId, category_id: recCategoryId || undefined, frequency: recFrequency, next_date: new Date().toISOString().slice(0, 10) };
      if (recEditing) {
        const res = await recurringApi.update(recEditing.id, data);
        await repository.update(TABLES.RECURRING, recEditing.id, res.data);
      } else {
        const res = await recurringApi.create(data);
        await repository.create(TABLES.RECURRING, res.data);
      }
      hapticSuccess(); setRecShowModal(false); recurringData.refresh();
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed'); }
    finally { setRecSaving(false); }
  };
  const handleRecDelete = (id: string) => {
    Alert.alert('Delete Recurring', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await recurringApi.delete(id); await repository.delete(TABLES.RECURRING, id); recurringData.refresh(); } },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    screenTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.text, padding: spacing.lg, paddingBottom: spacing.sm },
    container: { flex: 1, backgroundColor: colors.background },
    tabRow: { flexDirection: 'row', paddingHorizontal: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
    tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.card },
    tabActive: { backgroundColor: colors.primary },
    tabIcon: { fontSize: 16 },
    tabLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginTop: 2 },
    tabLabelActive: { color: colors.textInverse },
    content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxxl },
    card: {
      backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg,
      marginBottom: spacing.md, ...shadow.sm,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    cardTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text, flex: 1 },
    progressBar: { height: 8, backgroundColor: colors.tagBg, borderRadius: radius.full, overflow: 'hidden', marginVertical: spacing.sm },
    progressFill: { height: '100%', borderRadius: radius.full },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
    cardLabel: { fontSize: fontSize.xs, color: colors.textTertiary },
    cardValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
    badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    dueBadge: { backgroundColor: colors.dangerLight, color: colors.danger },
    soonBadge: { backgroundColor: colors.warningLight, color: colors.warning },
    paidBadge: { backgroundColor: colors.successLight, color: colors.success },
    fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4 },
    fabText: { fontSize: 28, color: colors.textInverse, marginTop: -2 },
    form: { padding: spacing.xl },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.xs },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.sm },
    typeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: spacing.sm, marginBottom: spacing.sm },
    typeChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
    choiceChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: spacing.sm, marginBottom: spacing.sm },
    choiceChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
    formActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    saveBtn: { flex: 1, backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
    saveBtnText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
    deleteBtn: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.dangerLight },
    deleteBtnText: { color: colors.danger, fontWeight: fontWeight.semibold },
    statRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    statBox: { flex: 1, minWidth: '45%', padding: spacing.md, borderRadius: radius.md },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
    recRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  }), [colors]);

  const renderBudgetsTab = () => {
    const { data: budgets, loading } = budgetsData;
    if (loading) return <CardSkeleton />;
    return (
      <View>
        {budgets.map((b) => {
          const pct = b.amount > 0 ? Math.min((b.spent || 0) / b.amount, 1) : 0;
          const barColor = pct >= 1 ? colors.danger : pct >= 0.8 ? colors.warning : colors.success;
          return (
            <TouchableOpacity key={b.id} style={styles.card} onPress={() => openBudgetEdit(b)} onLongPress={() => handleBudgetDelete(b.id)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{categoryMap[b.category_id || '']?.name || 'Budget'}</Text>
                <Text style={[styles.cardValue, { color: barColor }]}>{formatCurrency(b.spent || 0)} / {formatCurrency(b.amount)}</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>{b.period}</Text>
                <Text style={styles.cardLabel}>{Math.round(pct * 100)}% used</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {budgets.length === 0 && <EmptyState icon="📊" title="No budgets" subtitle="Create a budget to track spending" actionLabel="Add Budget" onAction={openBudgetCreate} />}
      </View>
    );
  };

  const renderGoalsTab = () => {
    const { data: goals, loading } = goalsData;
    if (loading) return <CardSkeleton />;
    return (
      <View>
        {goals.map((g) => {
          const pct = g.target_amount > 0 ? Math.min(g.current_amount / g.target_amount, 1) : 0;
          const days = g.deadline ? daysUntil(g.deadline) : null;
          const isOverdue = days !== null && days < 0;
          const isComplete = g.status === 'completed' || pct >= 1;
          return (
            <TouchableOpacity key={g.id} style={styles.card} onPress={() => openGoalEdit(g)} onLongPress={() => handleGoalDelete(g.id)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{g.name}</Text>
                {isComplete ? <Text style={[styles.badge, styles.paidBadge]}>✓ Done</Text> : isOverdue ? <Text style={[styles.badge, styles.dueBadge]}>Overdue</Text> : days !== null ? <Text style={[styles.badge, styles.soonBadge]}>{days}d left</Text> : null}
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: isComplete ? colors.success : colors.primary }]} />
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>{formatCurrency(g.current_amount)} / {formatCurrency(g.target_amount)}</Text>
                <Text style={[styles.cardLabel, { color: isComplete ? colors.success : colors.textTertiary }]}>{Math.round(pct * 100)}%</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {goals.length === 0 && <EmptyState icon="🎯" title="No goals" subtitle="Set a savings goal to track progress" actionLabel="Add Goal" onAction={openGoalCreate} />}
      </View>
    );
  };

  const renderBillsTab = () => {
    const { data: bills, loading } = billsData;
    if (loading) return <CardSkeleton />;
    return (
      <View>
        {bills.map((b) => {
          const dueDate = new Date(b.due_date);
          const today = new Date();
          const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const isOverdue = diffDays < 0 && !b.is_paid;
          const isSoon = diffDays >= 0 && diffDays <= (b.reminder_days_before || 3) && !b.is_paid;
          return (
            <TouchableOpacity key={b.id} style={styles.card} onPress={() => openBillEdit(b)} onLongPress={() => handleBillDelete(b.id)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{b.name}</Text>
                {b.is_paid ? <Text style={[styles.badge, styles.paidBadge]}>Paid</Text> : isOverdue ? <Text style={[styles.badge, styles.dueBadge]}>Overdue</Text> : isSoon ? <Text style={[styles.badge, styles.soonBadge]}>Due Soon</Text> : null}
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Amount</Text>
                <Text style={styles.cardValue}>{formatCurrency(b.amount)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Due {new Date(b.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                <TouchableOpacity onPress={() => toggleBillPaid(b)} accessibilityLabel="Toggle paid status" accessibilityRole="button">
                  <Text style={[styles.cardLabel, { color: b.is_paid ? colors.success : colors.textTertiary }]}>{b.is_paid ? '✓ Paid' : 'Mark Paid'}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
        {bills.length === 0 && <EmptyState icon="📄" title="No bills" subtitle="Add bills to track due payments" actionLabel="Add Bill" onAction={openBillCreate} />}
      </View>
    );
  };

  const renderRecurringTab = () => {
    const { data: recurring, loading } = recurringData;
    if (loading) return <ListSkeleton />;
    return (
      <View>
        {recurring.map((r) => {
          const acct = r.account_id ? accountMap[r.account_id] : undefined;
          const cat = r.category_id ? categoryMap[r.category_id] : undefined;
          return (
            <TouchableOpacity key={r.id} style={styles.card} onPress={() => openRecEdit(r)} onLongPress={() => handleRecDelete(r.id)}>
              <View style={styles.cardHeader}>
                <View style={styles.recRow}>
                  <View style={[styles.statusDot, { backgroundColor: r.is_active ? colors.success : colors.textTertiary }]} />
                  <Text style={styles.cardTitle}>{r.description || 'Recurring'}</Text>
                </View>
                <Text style={[styles.cardValue, { color: r.type === 'income' ? colors.success : colors.danger }]}>
                  {r.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(r.amount))}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>{r.frequency} every {r.interval} {r.interval > 1 ? 'times' : 'time'}</Text>
                <Text style={styles.cardLabel}>{acct?.name}{cat ? ` · ${cat.name}` : ''}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {recurring.length === 0 && <EmptyState icon="🔄" title="No recurring" subtitle="Set up recurring transactions" actionLabel="Add Recurring" onAction={openRecCreate} />}
      </View>
    );
  };

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'budgets': return renderBudgetsTab();
      case 'goals': return renderGoalsTab();
      case 'bills': return renderBillsTab();
      case 'recurring': return renderRecurringTab();
    }
  };

  const handleFabPress = () => {
    hapticLight();
    switch (activeTab) {
      case 'budgets': openBudgetCreate(); break;
      case 'goals': openGoalCreate(); break;
      case 'bills': openBillCreate(); break;
      case 'recurring': openRecCreate(); break;
    }
  };

  return (
    <View style={styles.container}>
      <Confetti active={showConfetti} />
      <Text style={styles.screenTitle}>Planner</Text>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
            accessibilityLabel={t.label}
            accessibilityRole="button"
          >
            <Text style={[styles.tabIcon, { opacity: activeTab === t.key ? 1 : 0.6 }]}>{t.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {renderActiveTabContent()}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={handleFabPress} accessibilityLabel={`Add ${activeTab.slice(0, -1)}`} accessibilityRole="button">
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Budget Modal */}
      <AdaptiveSheet visible={budgetShowModal} onClose={() => setBudgetShowModal(false)} title={budgetEditing ? 'Edit Budget' : 'New Budget'}>
        <View style={styles.form}>
          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} value={budgetAmount} onChangeText={setBudgetAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categoriesData.data.map((c) => (
              <TouchableOpacity key={c.id} style={[styles.choiceChip, budgetCategoryId === c.id && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]} onPress={() => setBudgetCategoryId(c.id)}>
                <Text style={{ fontSize: 14 }}>{c.icon}</Text>
                <Text style={[styles.choiceChipText, budgetCategoryId === c.id && { color: colors.primary }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Period</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['weekly', 'monthly', 'yearly'].map((p) => (
              <TouchableOpacity key={p} style={[styles.typeChip, budgetPeriod === p && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setBudgetPeriod(p as any)}>
                <Text style={[styles.typeChipText, budgetPeriod === p && { color: colors.textInverse }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.formActions}>
            {budgetEditing && (<TouchableOpacity style={styles.deleteBtn} onPress={() => { setBudgetShowModal(false); handleBudgetDelete(budgetEditing.id); }}><Text style={styles.deleteBtnText}>Delete</Text></TouchableOpacity>)}
            <TouchableOpacity style={[styles.saveBtn, budgetSaving && { opacity: 0.5 }]} onPress={handleBudgetSave} disabled={budgetSaving}>
              {budgetSaving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.saveBtnText}>{budgetEditing ? 'Update' : 'Create'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </AdaptiveSheet>

      {/* Goal Modal */}
      <AdaptiveSheet visible={goalShowModal} onClose={() => setGoalShowModal(false)} title={goalEditing ? 'Edit Goal' : 'New Goal'}>
        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={goalName} onChangeText={setGoalName} placeholder="Goal name" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Target Amount</Text>
          <TextInput style={styles.input} value={goalTarget} onChangeText={setGoalTarget} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Current Amount</Text>
          <TextInput style={styles.input} value={goalCurrent} onChangeText={setGoalCurrent} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Deadline</Text>
          <TextInput style={styles.input} value={goalDate} onChangeText={setGoalDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} />
          <View style={styles.formActions}>
            {goalEditing && (<TouchableOpacity style={styles.deleteBtn} onPress={() => { setGoalShowModal(false); handleGoalDelete(goalEditing.id); }}><Text style={styles.deleteBtnText}>Delete</Text></TouchableOpacity>)}
            <TouchableOpacity style={[styles.saveBtn, goalSaving && { opacity: 0.5 }]} onPress={handleGoalSave} disabled={goalSaving}>
              {goalSaving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.saveBtnText}>{goalEditing ? 'Update' : 'Create'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </AdaptiveSheet>

      {/* Bill Modal */}
      <AdaptiveSheet visible={billShowModal} onClose={() => setBillShowModal(false)} title={billEditing ? 'Edit Bill' : 'New Bill'}>
        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={billName} onChangeText={setBillName} placeholder="Bill name" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} value={billAmount} onChangeText={setBillAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Due Date</Text>
          <TextInput style={styles.input} value={billDueDate} onChangeText={setBillDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Recurrence</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['monthly', 'quarterly', 'yearly', 'one-time'].map((r) => (
              <TouchableOpacity key={r} style={[styles.typeChip, billRecurrence === r && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setBillRecurrence(r)}>
                <Text style={[styles.typeChipText, billRecurrence === r && { color: colors.textInverse }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Reminder (days before)</Text>
          <TextInput style={styles.input} value={billReminder} onChangeText={setBillReminder} keyboardType="number-pad" placeholder="3" placeholderTextColor={colors.textTertiary} />
          <View style={styles.formActions}>
            {billEditing && (<TouchableOpacity style={styles.deleteBtn} onPress={() => { setBillShowModal(false); handleBillDelete(billEditing.id); }}><Text style={styles.deleteBtnText}>Delete</Text></TouchableOpacity>)}
            <TouchableOpacity style={[styles.saveBtn, billSaving && { opacity: 0.5 }]} onPress={handleBillSave} disabled={billSaving}>
              {billSaving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.saveBtnText}>{billEditing ? 'Update' : 'Create'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </AdaptiveSheet>

      {/* Recurring Modal */}
      <AdaptiveSheet visible={recShowModal} onClose={() => setRecShowModal(false)} title={recEditing ? 'Edit Recurring' : 'New Recurring'}>
        <View style={styles.form}>
          <Text style={styles.label}>Description</Text>
          <TextInput style={styles.input} value={recDescription} onChangeText={setRecDescription} placeholder="Description" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Amount</Text>
          <TextInput style={styles.input} value={recAmount} onChangeText={setRecAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textTertiary} />
          <Text style={styles.label}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity style={[styles.typeChip, recType === 'expense' && { backgroundColor: colors.danger, borderColor: colors.danger }]} onPress={() => setRecType('expense')}>
              <Text style={[styles.typeChipText, recType === 'expense' && { color: colors.textInverse }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeChip, recType === 'income' && { backgroundColor: colors.success, borderColor: colors.success }]} onPress={() => setRecType('income')}>
              <Text style={[styles.typeChipText, recType === 'income' && { color: colors.textInverse }]}>Income</Text>
            </TouchableOpacity>
          </ScrollView>
          <Text style={styles.label}>Frequency</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['daily', 'weekly', 'monthly', 'yearly'].map((f) => (
              <TouchableOpacity key={f} style={[styles.typeChip, recFrequency === f && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setRecFrequency(f)}>
                <Text style={[styles.typeChipText, recFrequency === f && { color: colors.textInverse }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Account</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {accountsListData.data.map((a) => (
              <TouchableOpacity key={a.id} style={[styles.choiceChip, recAccountId === a.id && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]} onPress={() => setRecAccountId(a.id)}>
                <Text style={[styles.choiceChipText, recAccountId === a.id && { color: colors.primary }]}>{a.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categoriesData.data.filter((c) => c.type === recType).map((c) => (
              <TouchableOpacity key={c.id} style={[styles.choiceChip, recCategoryId === c.id && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]} onPress={() => setRecCategoryId(c.id)}>
                <Text style={{ fontSize: 14 }}>{c.icon}</Text>
                <Text style={[styles.choiceChipText, recCategoryId === c.id && { color: colors.primary }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.formActions}>
            {recEditing && (<TouchableOpacity style={styles.deleteBtn} onPress={() => { setRecShowModal(false); handleRecDelete(recEditing.id); }}><Text style={styles.deleteBtnText}>Delete</Text></TouchableOpacity>)}
            <TouchableOpacity style={[styles.saveBtn, recSaving && { opacity: 0.5 }]} onPress={handleRecSave} disabled={recSaving}>
              {recSaving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.saveBtnText}>{recEditing ? 'Update' : 'Create'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </AdaptiveSheet>
    </View>
  );
}
