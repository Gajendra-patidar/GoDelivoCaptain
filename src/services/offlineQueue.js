import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from './api';

const QUEUE_KEY = '@offline_queue';
let isFlushing = false; // Mutex to prevent duplicate parallel flushes

const load = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const save = async queue => {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore storage errors
  }
};

/**
 * Enqueue a request to be retried when the device comes back online.
 * @param {{ method: string, url: string, data?: object }} request
 */
const enqueue = async request => {
  const queue = await load();
  
  // Prevent duplicate requests in queue (e.g. clicking accept/complete multiple times offline)
  const isDuplicate = queue.some(
    item => item.url === request.url && item.method === request.method
  );

  if (isDuplicate) {
    console.log(`⚠️ Request already enqueued (skip duplicate): ${request.method} ${request.url}`);
    return;
  }

  queue.push({
    method: request.method || 'post',
    url: request.url,
    data: request.data,
    createdAt: Date.now()
  });
  await save(queue);
  console.log(`📥 Request enqueued offline: ${request.method} ${request.url}`);
};

/** Flush all queued requests (FIFO). Failed items are re-queued. */
const flush = async () => {
  if (isFlushing) {
    console.log('🔄 OfflineQueue flush already in progress. Skipping...');
    return;
  }

  isFlushing = true;
  const queue = await load();
  if (queue.length === 0) {
    isFlushing = false;
    return;
  }

  console.log(`🔄 OfflineQueue flushing ${queue.length} requests...`);
  const failed = [];

  try {
    // Dynamic token injection at flush time (critical for session expiration recovery)
    const token = await AsyncStorage.getItem('userToken');
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

    for (const req of queue) {
      // Drop items older than 24 hours
      if (Date.now() - req.createdAt > 24 * 60 * 60 * 1000) {
        console.log(`🗑️ Dropping stale offline request: ${req.url}`);
        continue;
      }

      try {
        await axios({
          method: req.method || 'post',
          url: `${BASE_URL.replace(/\/driver$/, '')}${req.url}`,
          data: req.data,
          headers: {
            ...authHeader,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        });
        console.log(`✅ Offline request synced successfully: ${req.url}`);
      } catch (error) {
        console.warn(`❌ Offline request failed for ${req.url}:`, error.message);
        
        // Re-queue only if it's a network issue or 5xx server error, not 4xx client validation errors
        const status = error.response?.status;
        if (!status || status >= 500) {
          failed.push(req);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in offline queue flush execution:', error);
  } finally {
    await save(failed);
    isFlushing = false;
  }
};

let unsubscribe = null;

/** Start listening for connectivity changes and auto-flush when online */
const startListening = () => {
  if (unsubscribe) return;

  unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected) {
      flush();
    }
  });
};

const stopListening = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
};

export const OfflineQueue = {
  enqueue,
  flush,
  startListening,
  stopListening,
};
