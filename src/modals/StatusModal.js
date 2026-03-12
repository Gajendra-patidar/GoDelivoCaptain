import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '../theme';

const StatusModal = ({ visible, onClose, isOnline }) => {
  const [seconds, setSeconds] = useState(3);

  useEffect(() => {
    if (!visible) return;

    setSeconds(3);

    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  // 👇 separate effect for closing
  useEffect(() => {
    if (seconds === 0 && visible) {
      onClose();
    }
  }, [seconds, visible, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View
            style={[
              styles.iconWrapper,
              isOnline ? styles.iconOnline : styles.iconOffline,
            ]}
          >
            <Ionicons
              name={isOnline ? 'checkmark' : 'close'}
              size={32}
              color="#fff"
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {isOnline ? 'You Are Online' : 'You Are Offline'}
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {isOnline
              ? 'You will now start receiving ride requests.'
              : 'You will not receive any ride requests.'}
          </Text>

          {/* Countdown */}
          <Text style={styles.countdown}>Closing in {seconds}s</Text>
        </View>
      </View>
    </Modal>
  );
};

export default StatusModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  container: {
    width: '85%',
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    ...theme.shadow.card,
  },

  iconWrapper: {
    height: 70,
    width: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconOnline: {
    backgroundColor: theme.colors.success,
  },
  iconOffline: {
    backgroundColor: '#FF4D4D',
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.ink,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: '#6b6b6b',
    textAlign: 'center',
    marginBottom: 15,
  },

  countdown: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
});

