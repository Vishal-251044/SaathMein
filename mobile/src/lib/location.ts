/**
 * One-time location lookup for city auto-detect (ACC-2). Asks for "while using the app"
 * permission only when the user taps "Use my location"; never tracks in the background.
 */
import * as Location from 'expo-location';

export type LocationErrorCode = 'PERMISSION_DENIED' | 'LOCATION_UNAVAILABLE';

/** Error with a code the UI can translate. */
export class LocationError extends Error {
  code: LocationErrorCode;

  /** @param code - Stable error code */
  constructor(code: LocationErrorCode) {
    super(code);
    this.name = 'LocationError';
    this.code = code;
  }
}

export interface DetectedLocation {
  latitude: number;
  longitude: number;
  pincode?: string;
}

/**
 * Get the phone's approximate position and pincode.
 * @returns Coordinates (rounded to ~100 m) and the pincode when the phone can find it
 * @throws LocationError PERMISSION_DENIED or LOCATION_UNAVAILABLE
 */
export async function detectLocation(): Promise<DetectedLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) throw new LocationError('PERMISSION_DENIED');

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, // city/area level is enough, and saves battery
    });
    // Round before sending: we only need the area, not the exact house
    const latitude = Number(position.coords.latitude.toFixed(3));
    const longitude = Number(position.coords.longitude.toFixed(3));

    let pincode: string | undefined;
    try {
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      pincode =
        address?.postalCode && /^\d{6}$/.test(address.postalCode) ? address.postalCode : undefined;
    } catch {
      // Reverse geocoding can fail offline; coordinates are still enough to find the city
    }
    return { latitude, longitude, pincode };
  } catch {
    throw new LocationError('LOCATION_UNAVAILABLE');
  }
}
