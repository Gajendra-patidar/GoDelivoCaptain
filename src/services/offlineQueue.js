import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from './api';

const QUEUE_KEY = '@offline_queue';

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
 * @param {{ method: string, url: string, data?: object, headers?: object }} request
 */
const enqueue = async request => {
  const queue = await load();
  queue.push({ ...request, createdAt: Date.now() });
  await save(queue);
};

/** Flush all queued requests (FIFO). Failed items are re-queued. */
const flush = async () => {
  const queue = await load();
  if (queue.length === 0) return;

  const failed = [];

  for (const req of queue) {
    try {
      await axios({
        method: req.method || 'post',
        url: `${BASE_URL}${req.url}`,
        data: req.data,
        headers: req.headers,
        timeout: 15000,
      });
    } catch {
      // Only retry items less than 24 hours old
      if (Date.now() - req.createdAt < 24 * 60 * 60 * 1000) {
        failed.push(req);
      }
    }
  }

  await save(failed);
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
