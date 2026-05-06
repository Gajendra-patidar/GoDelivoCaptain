import { StyleSheet, Text } from 'react-native';
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
import ToastManager from 'toastify-react-native';


function App() {
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

      } catch (error) {
        console.error('❌ App initialization error:', error);
      }
    };

    initApp();

    return () => {
      OfflineQueue.stopListening();
      SocketService.cleanup();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <Provider store={store}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.container} edges={['right', 'left', 'top']}>
            <ErrorBoundary>
              <MainNavigation />
            </ErrorBoundary>
            <ToastManager />
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
