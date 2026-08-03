import { useSelector } from 'react-redux';
import { selectIsOnline } from '../store/slices/onlineStatusSlice';
import FloatingBubble from './FloatingBubble';
import { navigationRef } from '../navigations/navigationRef';

const BubbleController = () => {
  const isOnline = useSelector(selectIsOnline);

  // Instead of relying on a native Android service that might not be installed,
  // we render the React Native floating bubble inside the app.
  return <FloatingBubble navigation={navigationRef} isVisible={isOnline} />;
};

export default BubbleController;
