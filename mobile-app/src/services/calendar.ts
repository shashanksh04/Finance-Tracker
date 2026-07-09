import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

const CALENDAR_TITLE = 'Finance Tracker';

async function ensureCalendar(): Promise<string | null> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') return null;

  const calendars = await Calendar.getCalendarsAsync();
  const appCal = calendars.find((c) => c.title === CALENDAR_TITLE);
  if (appCal) return appCal.id;

  if (Platform.OS === 'android') {
    const newId = await Calendar.createCalendarAsync({
      title: CALENDAR_TITLE,
      color: '#0284c7',
      entityType: Calendar.EntityTypes.EVENT,
      name: 'FinanceTracker',
      ownerAccount: 'app',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    return newId;
  }

  const defaultCal = calendars.find((c) => c.allowsModifications);
  return defaultCal?.id || null;
}

export async function addBillReminder(
  title: string,
  dueDate: string,
  notes?: string,
  reminderDays = 1
): Promise<string | null> {
  try {
    const calId = await ensureCalendar();
    if (!calId) return null;

    const due = new Date(dueDate);
    const alarmDate = new Date(due);
    alarmDate.setDate(alarmDate.getDate() - reminderDays);
    alarmDate.setHours(9, 0, 0, 0);

    const eventId = await Calendar.createEventAsync(calId, {
      title: `💰 ${title}`,
      startDate: alarmDate,
      endDate: alarmDate,
      notes: notes || `Bill due: ${dueDate}`,
      alarms: [{ relativeOffset: 0 }],
    });

    return eventId;
  } catch {
    return null;
  }
}

export async function removeBillReminder(eventId: string): Promise<boolean> {
  try {
    await Calendar.deleteEventAsync(eventId);
    return true;
  } catch {
    return false;
  }
}
