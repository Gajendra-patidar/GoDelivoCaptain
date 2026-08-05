import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useSelector } from 'react-redux';
import { selectIsOnline } from '../store/slices/onlineStatusSlice';
import { startOverlayBubble, stopOverlayBubble } from '../services/FloatingBubbleService';

const BubbleController = () => {
  const isOnline = useSelector(selectIsOnline);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    if (isOnline) {
      startOverlayBubble();
    } else {
      stopOverlayBubble();
    }
  }, [isOnline]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const appStateSub = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && isOnline) {
        await startOverlayBubble();
      }
    });

    return () => {
      appStateSub.remove();
    };
  }, [isOnline]);

  return null;
};

export default BubbleController;
