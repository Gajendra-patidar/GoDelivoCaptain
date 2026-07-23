import { StyleSheet, useColorScheme, AppState, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MainNavigation from './src/navigations/mainNavigation';
import { Provider } from 'react-redux';
import { store } from './src/store/store';
import './src/i18n/i18n';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from './src/services/NotificationService';
import ErrorBoundary from './src/components/ErrorBoundary';
import { OfflineQueue } from './src/services/offlineQueue';
import SocketService from './src/services/socketService';
import PremiumToast from './src/components/PremiumToast';
import { getThemeForScheme } from './src/theme';
import { startOverlayBubble } from './src/services/FloatingBubbleService';
import { navigationRef } from './src/navigations/navigationRef';


function App() {
  const colorScheme = useColorScheme();
  const appTheme = getThemeForScheme(colorScheme);

  useEffect(() => {
    const initApp = async () => {
      try {
        const driverId = await AsyncStorage.getItem('driverId');
        const token = await AsyncStorage.getItem('userToken');

        // Initialize notifications
        if (driverId) {
          await NotificationService.initialize(driverId);
        }

        // Initialize socket connection for real-time updates
        if (driverId && token) {
          console.log('🚀 Initializing socket connection...');
          await SocketService.connect();
        }

        // Start offline queue
        OfflineQueue.startListening();

        // Start system-level floating bubble (Android only)
        if (Platform.OS === 'android') {
          await startOverlayBubble();
        }

      } catch (error) {
        console.error('❌ App initialization error:', error);
      }
    };

    initApp();

    // Re-attempt starting the bubble when user returns from Settings
    // (they may have just granted the Draw-over-other-apps permission)
    const appStateSub = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && Platform.OS === 'android') {
        await startOverlayBubble();
      }
    });

    return () => {
      appStateSub.remove();
      OfflineQueue.stopListening();
      SocketService.cleanup();
      // Bubble service keeps running after app closes (stopWithTask=false)
      // Uncomment below to stop it on unmount instead:
      // stopOverlayBubble();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>
        <SafeAreaProvider>
          <SafeAreaView
            style={[
              styles.container,
              { backgroundColor: appTheme.colors.bg },
            ]}
            edges={['right', 'left', 'top']}
          >
            <ErrorBoundary>
              <MainNavigation />
            </ErrorBoundary>
            <PremiumToast />
          </SafeAreaView>
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});

export default App;
