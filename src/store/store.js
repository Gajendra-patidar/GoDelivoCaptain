import { configureStore } from '@reduxjs/toolkit';
import onlineStatusReducer from './slices/onlineStatusSlice';

export const store = configureStore({
  reducer: {
    onlineStatus: onlineStatusReducer,
    // Add other reducers here
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;