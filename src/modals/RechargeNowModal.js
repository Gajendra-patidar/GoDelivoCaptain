import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const RechargeNowModal = ({ visible, onClose, walletBalance, onRecharge }) => {
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('100');
  const [loading, setLoading] = useState(false);

  const suggestedAmounts = [50, 100, 200];

  useEffect(() => {
    if (!visible) {
      setSelectedAmount(null);
      setCustomAmount('100');
    }
  }, [visible]);

  const handleAmountSelect = amount => {
    setSelectedAmount(amount);
    setCustomAmount(String(amount));
  };

  const handleRecharge = async () => {
    const amount = Number(customAmount || selectedAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid recharge amount.');
      return;
    }

    try {
      setLoading(true);
      await onRecharge?.(amount);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Recharge Wallet</Text>
            <TouchableOpacity onPress={onClose} style={styles.closebtn}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Wallet Balance:</Text>
            <Text style={styles.balanceAmount}>Rs {Number(walletBalance || 0).toFixed(2)}</Text>
          </View>

          <View style={styles.amountInputContainer}>
            <Text style={styles.currencySymbol}>Rs</Text>
            <TextInput
              style={styles.amountInput}
              value={customAmount}
              onChangeText={setCustomAmount}
              keyboardType="numeric"
              placeholder="100"
              placeholderTextColor="#000"
            />
          </View>

          <View style={styles.suggestedContainer}>
            {suggestedAmounts.map(amount => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.suggestedBtn,
                  selectedAmount === amount && styles.suggestedBtnSelected,
                ]}
                onPress={() => handleAmountSelect(amount)}
              >
                <Text
                  style={[
                    styles.suggestedText,
                    selectedAmount === amount && styles.suggestedTextSelected,
                  ]}
                >
                  + Rs {amount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.rechargeNowBtn} onPress={handleRecharge} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.rechargeNowText}>Recharge Rs {amountLabel(customAmount, walletBalance)}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.noteText}>Amount will be added to your wallet balance.</Text>
        </View>
      </View>
    </Modal>
  );
};

const amountLabel = (customAmount, walletBalance) => {
  const amount = Number(customAmount || 0);
  if (Number.isFinite(amount) && amount > 0) {
    return amount.toFixed(0);
  }
  return Number(walletBalance || 0).toFixed(0);
};

export default RechargeNowModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    paddingBottom: 35,
  },
  closebtn: {
    position: 'absolute',
    right: 0,
    top: -5,
    backgroundColor: '#f2f2f2',
    height: 40,
    width: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#666',
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    paddingVertical: 12,
  },
  suggestedContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  suggestedBtn: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestedBtnSelected: {
    backgroundColor: '#F4C20D',
    borderColor: '#F4C20D',
  },
  suggestedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  suggestedTextSelected: {
    color: '#000',
  },
  rechargeNowBtn: {
    backgroundColor: '#F4C20D',
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  rechargeNowText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  noteText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
});
