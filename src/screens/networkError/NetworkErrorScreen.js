// screens/NetworkErrorScreen.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors } from '../../theme';

const { width, height } = Dimensions.get('window');

const NetworkErrorScreen = ({ onRetry, isRetrying }) => {
  return (
    <View style={styles.container}>
      {/* WiFi Off Icon */}
      <View style={styles.iconContainer}>
        <Image
          source={require('../../assets/no-wifi.png')} // Add your own icon
          style={styles.icon}
          resizeMode="contain"
        />
      </View>

      {/* Error Message */}
      <Text style={styles.title}>No Internet Connection</Text>
      <Text style={styles.subtitle}>
        Please check your internet connection and try again
      </Text>

      {/* Retry Button */}
      <TouchableOpacity
        style={styles.retryButton}
        onPress={onRetry}
        disabled={isRetrying}
      >
        {isRetrying ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={styles.retryText}>Try Again</Text>
        )}
      </TouchableOpacity>

      {/* Additional Info */}
      <Text style={styles.hint}>
        • Check if WiFi or Mobile Data is turned on{'\n'}
        • Try switching between WiFi and Mobile Data{'\n'}
        • Check if Airplane Mode is turned off
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    width: 120,
    height: 120,
    backgroundColor: '#FFE5E5',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: '#FF3B30',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A2E',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NetworkErrorScreen;