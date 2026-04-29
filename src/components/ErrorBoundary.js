import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '../theme';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      isConnected: true,
      connectionType: null,
      isInternetReachable: true,
      errorDetails: null
    };
    this.unsubscribeNetInfo = null;
  }

  componentDidMount() {
    // Subscribe to network state updates
    this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
            this.setState({
        isConnected: state.isConnected,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable
      });
    });

    // Get initial network state
    this.checkNetworkConnection();
  }

  componentWillUnmount() {
    // Clean up the event listener
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorDetails: error?.message || 'Unknown error'
    };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
    // You can log to your error reporting service here
    this.setState({ errorDetails: error?.message });
  }

  checkNetworkConnection = async () => {
    try {
      const netInfo = await NetInfo.fetch();
            this.setState({
        isConnected: netInfo.isConnected,
        connectionType: netInfo.type,
        isInternetReachable: netInfo.isInternetReachable
      });
    } catch (error) {
      console.error('Network check error:', error);
    }
  };

  handleRetry = async () => {
    // First check network connection
    await this.checkNetworkConnection();

    // If connected, reset error state
    if (this.state.isConnected && this.state.isInternetReachable) {
      this.setState({ hasError: false, errorDetails: null });
    } else {
      // Force re-render to show updated connection status
      this.forceUpdate();
    }
  };

  getConnectionIcon = () => {
    const { isConnected, connectionType } = this.state;

    if (!isConnected) {
      return 'wifi-outline';
    }

    switch (connectionType) {
      case 'wifi':
        return 'wifi';
      case 'cellular':
        return 'cellular-outline';
      case 'ethernet':
        return 'server-outline';
      default:
        return 'wifi-outline';
    }
  };

  getConnectionStatus = () => {
    const { isConnected, connectionType, isInternetReachable } = this.state;

    if (!isConnected) {
      return {
        title: 'No Internet Connection',
        message: 'Please check your Wi-Fi or mobile data connection.',
        icon: 'wifi-outline',
        action: 'Connect to Wi-Fi or mobile data'
      };
    }

    if (!isInternetReachable) {
      return {
        title: 'Limited Connection',
        message: 'Connected but no internet access. Please check your network settings.',
        icon: 'alert-circle-outline',
        action: 'Check network settings'
      };
    }

    if (connectionType === 'cellular' && Platform.OS === 'android') {
      return {
        title: 'Mobile Data Active',
        message: 'You are using mobile data. Please ensure data is enabled.',
        icon: 'cellular-outline',
        action: 'Check data connection'
      };
    }

    return {
      title: 'Something went wrong',
      message: 'An unexpected error occurred. Please try again.',
      icon: 'bug-outline',
      action: 'Refresh the app'
    };
  };

  renderConnectionDetails = () => {
    const { connectionType, isConnected } = this.state;

    if (!isConnected) return null;

    let connectionText = '';
    let connectionIcon = '';

    if (connectionType === 'wifi') {
      connectionText = 'Wi-Fi';
      connectionIcon = '📶';
    }
    if (connectionType === 'cellular') {
      connectionText = 'Mobile Data';
      connectionIcon = '📱';
    }
    if (connectionType === 'ethernet') {
      connectionText = 'Ethernet';
      connectionIcon = '🔌';
    }

    if (!connectionText) return null;

    return (
      <View style={styles.connectionInfo}>
        <Text style={styles.connectionType}>
          {connectionIcon} Connected via: {connectionText}
        </Text>
      </View>
    );
  };

  render() {
    const { hasError, isConnected } = this.state;

    if (hasError) {
      const status = this.getConnectionStatus();

      return (
        <View style={styles.container}>
          <Ionicons
            name={this.getConnectionIcon()}
            size={64}
            color={!isConnected ? '#EF4444' : theme.colors.primary}
          />

          <Text style={styles.title}>{status.title}</Text>
          <Text style={styles.sub}>{status.message}</Text>

          {this.renderConnectionDetails()}

          <TouchableOpacity style={styles.btn} onPress={this.handleRetry}>
            <Ionicons name="refresh" size={18} color="#000" />
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>

          {!isConnected && (
            <TouchableOpacity
              style={[styles.btn, styles.secondaryBtn]}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }}
            >
              <Ionicons name="settings-outline" size={18} color="#000" />
              <Text style={styles.btnText}>Open Settings</Text>
            </TouchableOpacity>
          )}

          {__DEV__ && this.state.errorDetails && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugText}>
                Error: {this.state.errorDetails}
              </Text>
            </View>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
    padding: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.ink,
    marginTop: 20,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  secondaryBtn: {
    backgroundColor: '#F3F4F6',
    marginTop: 12,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
  },
  connectionInfo: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  connectionType: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  debugContainer: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    width: '100%',
  },
  debugText: {
    fontSize: 10,
    color: '#DC2626',
    textAlign: 'center',
  },
});