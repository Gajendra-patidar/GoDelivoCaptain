import {Platform, Alert} from 'react-native';
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

  // Step 2: Prominent Disclosure and Request
  if (result === RESULTS.DENIED) {
    return new Promise((resolve) => {
      Alert.alert(
        'Location Permission Required',
        'GoDelivo Captain collects location data to enable tracking your deliveries, providing accurate ETAs, and assigning nearby orders even when the app is closed or not in use.',
        [
          {
            text: 'Cancel',
            onPress: () => resolve(false),
            style: 'cancel',
          },
          {
            text: 'Accept',
            onPress: async () => {
              const requestResult = await request(permission);
              resolve(requestResult === RESULTS.GRANTED);
            },
          },
        ],
        {cancelable: false},
      );
    });
  }

  // BLOCKED / UNAVAILABLE
  return false;
};