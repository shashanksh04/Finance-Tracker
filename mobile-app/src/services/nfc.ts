import { Platform } from 'react-native';

export interface NfcTag {
  id: string;
  type: string;
  payload?: string;
}

export async function readNfcTag(): Promise<NfcTag | null> {
  try {
    const NfcManager = require('react-native-nfc-manager').default;
    await NfcManager.start();
    const tag = await NfcManager.getTag();
    if (!tag) return null;
    return {
      id: tag.id,
      type: tag.technology || 'unknown',
      payload: tag.ndefMessage?.[0]?.payload?.toString() || undefined,
    };
  } catch {
    return null;
  }
}

export function isNfcSupported(): boolean {
  return Platform.OS === 'android';
}
