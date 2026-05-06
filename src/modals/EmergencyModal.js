import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import toast from '../utils/toast';

const EmergencyModal = ({ visible, onClose }) => {
  const handleCall = (number, label) => {
    const url = `tel:${number}`;
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          toast.error(`Unable to call ${label}. Please dial ${number} manually.`);
        }
      })
      .catch(() => {
        toast.error(`Failed to initiate call to ${label}.`);
      });
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          
          {/* Close Button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#000" />
          </TouchableOpacity>

          {/* Siren Icon */}
          <View style={styles.iconWrapper}>
            <Ionicons name="medical-outline" size={32} color="#fff" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Emergency Assistance</Text>
          <Text style={styles.subtitle}>
            Use these options only in emergency
          </Text>

          {/* Options Row */}
          <View style={styles.row}>
            
            {/* Police Card */}
            <TouchableOpacity style={styles.card} onPress={() => handleCall('100', 'Police')}>
              <Ionicons name="car-outline" size={28} color="#1c1c1c" />
              <Text style={styles.cardText}>Call</Text>
              <Text style={styles.cardText}>Police</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="#000"
                style={styles.arrow}
              />
            </TouchableOpacity>

            {/* Ambulance Card */}
            <TouchableOpacity style={styles.card} onPress={() => handleCall('102', 'Ambulance')}>
              <Ionicons name="medkit-outline" size={28} color="#464545" />
              <Text style={styles.cardText}>Call</Text>
              <Text style={styles.cardText}>Ambulance</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="#000"
                style={styles.arrow}
              />
            </TouchableOpacity>

          </View>

        </View>
      </View>
    </Modal>
  );
};

export default EmergencyModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },

  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 30,
  },

  closeBtn: {
    position: 'absolute',
    right: 20,
    top: 20,
    backgroundColor: '#f2f2f2',
    height: 40,
    width: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  iconWrapper: {
    height: 50,
    width: 50,
    borderRadius: 35,
    backgroundColor: '#ff2d55',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 15,
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 5,
  },

  subtitle: {
    fontSize: 15,
    color: '#6b6b6b',
    marginBottom: 25,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  card: {
    width: '48%',
    backgroundColor: '#f7f7f7',
    borderRadius: 16,
    padding: 18,
    position: 'relative',
    borderWidth:1,
    borderColor:'#ffd000'
  },

  cardText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },

  arrow: {
    position: 'absolute',
    right: 15,
    top: 50,
  },
});