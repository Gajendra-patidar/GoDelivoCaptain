import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SocketService from '../../services/socketService';
import { API_HOST } from '../../services/api';

const DriverChatScreen = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [driverId, setDriverId] = useState(route.params.driverId || null);
  const [driverToken, setDriverToken] = useState(route.params.driverToken || null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);

  useEffect(() => {
    const initData = async () => {
      let dId = driverId;
      let dToken = driverToken;
      if (!dId) dId = await AsyncStorage.getItem('driverId');
      if (!dId) {
        const userDataRaw = await AsyncStorage.getItem('userData');
        const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
        dId = userData?._id || userData?.id;
      }
      if (!dToken) dToken = await AsyncStorage.getItem('userToken');
      
      setDriverId(dId);
      setDriverToken(dToken);
      
      if (dId && dToken) {
        fetchChatHistory(dToken);
      } else {
        setLoading(false);
      }
    };
    initData();
  }, [rideId]);

  useEffect(() => {
    if (!driverId) return;

    let cleanedUp = false;

    const setupSocket = async () => {
      // Ensure socket is connected before emitting – connect() is async
      if (!SocketService.isSocketConnected()) {
        await SocketService.connect();
      }

      // Guard: component may have unmounted during the async connect
      if (cleanedUp) return;

      if (SocketService.socket) {
        // Register presence inside chat namespace
        SocketService.socket.emit('chat:join', {
          rideId,
          userId: driverId,
          userType: 'driver',
        });

        // Listen for real-time messages (own + customer replies)
        SocketService.socket.on('chat:new_message', (msg) => {
          setMessages((prev) => {
            // Deduplication: skip if already in list (optimistic or echoed)
            if (prev.some((m) => m._id && m._id === msg._id)) return prev;
            return [
              ...prev,
              {
                ...msg,
                isOwnMessage:
                  msg.senderId != null &&
                  msg.senderId.toString() === driverId.toString(),
              },
            ];
          });
        });
      }
    };

    setupSocket();

    return () => {
      cleanedUp = true;
      if (SocketService.socket) {
        SocketService.socket.emit('chat:leave', { rideId });
        SocketService.socket.off('chat:new_message');
      }
    };
  }, [rideId, driverId]);

  // Keep FlatList scrolled to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const fetchChatHistory = async (token) => {
    try {
      const response = await fetch(`${API_HOST}/chat/history/${rideId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const res = await response.json();
      if (res.success) {
        // Mark each historical message with isOwnMessage flag
        const currentDriverId = driverId;
        const enriched = (res.data.messages || []).map(msg => ({
          ...msg,
          isOwnMessage:
            msg.senderId != null &&
            currentDriverId != null &&
            msg.senderId.toString() === currentDriverId.toString(),
        }));
        setMessages(enriched);
      }
    } catch (error) {
      console.error('History API error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    const text = inputText.trim();
    if (text === '') return;

    if (SocketService.socket && SocketService.socket.connected) {
      setInputText('');

      SocketService.socket.emit('chat:send_message', {
        rideId,
        senderId: driverId,
        message: text,
      });
    } else {
      // Socket not ready – reconnect and inform driver
      console.warn('[Chat] Socket not connected. Attempting reconnect...');
      SocketService.connect();
    }
  };

  const renderBubble = ({ item }) => {
    const isOwn = item.isOwnMessage;
    return (
      <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
        <Text style={[styles.senderName, isOwn ? styles.ownText : styles.otherText]}>
          {isOwn ? 'You' : item.senderName}
        </Text>
        <Text style={[styles.messageText, isOwn ? styles.ownText : styles.otherText]}>
          {item.message}
        </Text>
        <Text style={[styles.timestamp, isOwn ? styles.ownTime : styles.otherTime]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#0080ff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Customer Support</Text>
            <Text style={styles.headerSubtitle}>Order #{String(rideId).slice(-6).toUpperCase()}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id || Math.random().toString()}
          renderItem={renderBubble}
          contentContainerStyle={styles.listContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        />
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity 
              style={[
                styles.sendButton,
                inputText.trim() === '' ? styles.sendButtonDisabled : null
              ]} 
              onPress={handleSendMessage}
              disabled={inputText.trim() === ''}
              activeOpacity={0.8}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={inputText.trim() === '' ? '#a0c8f0' : '#fff'} 
                style={{ marginLeft: 3 }} // Visual alignment for the send icon
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f6f9' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  listContainer: { padding: 16, gap: 14, paddingBottom: 20 },
  bubble: { 
    maxWidth: '82%', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  ownBubble: { 
    alignSelf: 'flex-end', 
    backgroundColor: '#0080ff', 
    borderBottomRightRadius: 4 
  },
  otherBubble: { 
    alignSelf: 'flex-start', 
    backgroundColor: '#fff', 
    borderBottomLeftRadius: 4, 
  },
  senderName: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  timestamp: { fontSize: 10, alignSelf: 'flex-end', marginTop: 6, fontWeight: '500' },
  ownText: { color: '#fff' },
  otherText: { color: '#333' },
  ownTime: { color: 'rgba(255,255,255,0.75)' },
  otherTime: { color: '#aaa' },
  inputContainer: { 
    padding: 12, 
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#fff', 
    borderTopWidth: 1, 
    borderColor: '#eee' 
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f4f6f9',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#eaeaea'
  },
  textInput: { 
    flex: 1, 
    minHeight: 40,
    maxHeight: 120,
    fontSize: 15,
    paddingHorizontal: 12, 
    paddingTop: 10,
    paddingBottom: 10,
    color: '#333'
  },
  sendButton: { 
    backgroundColor: '#0080ff', 
    borderRadius: 20, 
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2
  },
  sendButtonDisabled: {
    backgroundColor: '#e0e0e0',
  }
});

export default DriverChatScreen;
