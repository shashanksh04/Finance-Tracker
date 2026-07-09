import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import { useOfflineList } from '../hooks/useOfflineData';
import { useHaptics } from '../hooks/useHaptics';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';
import { addBillReminder, removeBillReminder } from '../services/calendar';
import { CardSkeleton } from '../components/ui/SkeletonLoader';
import type { Bill } from '../types';

export default function CalendarSyncScreen() {
  const { success: hapticSuccess, light: hapticLight } = useHaptics();
  const { data: bills, loading, refreshing, refreshFromApi } = useOfflineList<Bill>(TABLES.BILLS);
  const [syncing, setSyncing] = useState(false);

  if (loading) return <CardSkeleton />;

  const handleSyncAll = async () => {
    setSyncing(true);
    let synced = 0;
    for (const bill of bills) {
      if (bill.status !== 'active') continue;
      // remove old event if exists
      if ((bill as any).calendar_event_id) {
        await removeBillReminder((bill as any).calendar_event_id);
      }
      const eventId = await addBillReminder(
        bill.name,
        bill.next_due_date || bill.created_at,
        `Amount: ₹${bill.amount}`
      );
      if (eventId) {
        await repository.update(TABLES.BILLS, bill.id, { ...bill, calendar_event_id: eventId });
        synced++;
      }
    }
    setSyncing(false);
    hapticSuccess();
    Alert.alert('Calendar Sync', `${synced} bill reminders added to calendar.`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFromApi} />}>
      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>📅</Text>
        <Text style={styles.infoTitle}>Calendar Sync</Text>
        <Text style={styles.infoText}>
          Sync your active bills to your device calendar so you never miss a payment.
          Reminders will be set 1 day before each due date.
        </Text>
      </View>

      <View style={styles.billsSection}>
        <Text style={styles.sectionTitle}>Active Bills ({bills.filter((b) => b.status === 'active').length})</Text>
        {bills.filter((b) => b.status === 'active').length === 0 && (
          <Text style={styles.emptyText}>No active bills to sync. Create bills first!</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.syncBtn, syncing && { opacity: 0.5 }]}
        onPress={handleSyncAll}
        disabled={syncing || bills.filter((b) => b.status === 'active').length === 0}
      >
        {syncing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.syncBtnText}>Sync All to Calendar</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 40 },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.md,
    marginBottom: spacing.lg,
  },
  infoIcon: { fontSize: 48, marginBottom: spacing.md },
  infoTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm },
  infoText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  billsSection: { marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', padding: spacing.lg },
  syncBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  syncBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: '#fff' },
});
