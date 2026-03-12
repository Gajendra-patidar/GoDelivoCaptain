import { StyleSheet } from 'react-native';
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

function App() {
  useEffect(() => {
    const initNotifications = async () => {
      try {
        const driverId = await AsyncStorage.getItem('driverId');
        if (driverId) {
          await NotificationService.initialize(driverId);
        }
      } catch {}
    };

    initNotifications();
    OfflineQueue.startListening();

    return () => OfflineQueue.stopListening();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.container} edges={['right', 'left', 'top']}>
            <ErrorBoundary>
              <MainNavigation />
            </ErrorBoundary>
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
