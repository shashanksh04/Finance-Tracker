import * as Location from 'expo-location';
import { Platform } from 'react-native';

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number; address?: string; name?: string } | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const geocode = await Location.reverseGeocodeAsync({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });

    const addr = geocode[0];
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      address: addr ? [addr.street, addr.city, addr.region].filter(Boolean).join(', ') : undefined,
      name: addr?.name || addr?.street || undefined,
    };
  } catch {
    return null;
  }
}
