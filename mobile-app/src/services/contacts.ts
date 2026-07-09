import * as Contacts from 'expo-contacts';

export interface ContactInfo {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export async function requestContactsPermission(): Promise<boolean> {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
}

export async function getContacts(search?: string): Promise<ContactInfo[]> {
  try {
    const hasPermission = await requestContactsPermission();
    if (!hasPermission) return [];

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      sort: Contacts.SortTypes.FirstName,
    });

    let contacts = data.map((c) => ({
      id: c.id || '',
      name: c.name || 'Unknown',
      phone: c.phoneNumbers?.[0]?.number || undefined,
      email: c.emails?.[0]?.email || undefined,
    }));

    if (search) {
      const q = search.toLowerCase();
      contacts = contacts.filter((c) => c.name.toLowerCase().includes(q) || c.phone?.includes(search));
    }

    return contacts.slice(0, 50);
  } catch {
    return [];
  }
}
