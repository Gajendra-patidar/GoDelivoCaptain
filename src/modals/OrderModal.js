import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

export const OrderModal = ({
  visible,
  onClose,
  orderData,
  onAccept,
  onReject,
}) => {
  const [timeLeft, setTimeLeft] = useState(15);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTimeLeft(15);
      setIsExpired(false);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  const resetAndClose = () => {
    setTimeLeft(15);
    setIsExpired(false);
    onClose();
  };

  const handleAccept = () => {
    onAccept?.(orderData);
    resetAndClose();
  };

  const handleReject = () => {
    onReject?.(orderData);
    resetAndClose();
  };

  const amount = Number(orderData?.amount || 0).toFixed(0);
  const pickupDistance = Number(orderData?.pickupDistanceKm || 0).toFixed(1);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={resetAndClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {isExpired ? (
            <>
              <Ionicons name="time-outline" size={48} color="#FF5252" />
              <Text style={styles.expiredTitle}>Order Expired</Text>
              <Text style={styles.expiredText}>
                Another partner accepted this order.
              </Text>
              <TouchableOpacity style={styles.okButton} onPress={resetAndClose}>
                <Text style={styles.okText}>OK</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.timerText}>Accept in {timeLeft}s</Text>
              <Text style={styles.amount}>Rs {amount}</Text>

              <View style={styles.pickupChip}>
                <Ionicons name="location-outline" size={15} color="#1F8B4D" />
                <Text style={styles.pickupChipText}>
                  Pickup {pickupDistance} km away
                </Text>
              </View>

              <Text style={styles.address} numberOfLines={1}>
                Pickup: {orderData?.pickupAddress || '--'}
              </Text>
              <Text style={styles.address} numberOfLines={1}>
                Drop: {orderData?.dropAddress || '--'}
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 30,
  },
  content: {
    width: width * 0.92,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
  },
  timerText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 8,
  },
  amount: {
    textAlign: 'center',
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  pickupChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8EE',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
  },
  pickupChipText: {
    marginLeft: 4,
    color: '#1F8B4D',
    fontWeight: '600',
    fontSize: 12,
  },
  address: {
    color: '#374151',
    fontSize: 13,
    marginBottom: 5,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  rejectButton: {
    width: '48%',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rejectText: {
    color: '#374151',
    fontWeight: '700',
  },
  acceptButton: {
    width: '48%',
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptText: {
    color: '#fff',
    fontWeight: '700',
  },
  expiredTitle: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 8,
  },
  expiredText: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 18,
  },
  okButton: {
    backgroundColor: '#F4C20D',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  okText: {
    fontWeight: '700',
    color: '#000',
  },
});
