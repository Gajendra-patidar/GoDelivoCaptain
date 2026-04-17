import {Platform} from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
} from 'react-native-permissions';

export const getLocationPermission = async () => {
  const permission =
    Platform.OS === 'android'
      ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
      : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;

  // Step 1: Check
  let result = await check(permission);

  if (result === RESULTS.GRANTED) {
    return true;
  }

  // Step 2: Request only if needed
  if (result === RESULTS.DENIED) {
    result = await request(permission);
    return result === RESULTS.GRANTED;
  }

  // BLOCKED / UNAVAILABLE
  return false;
};