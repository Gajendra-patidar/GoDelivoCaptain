import { configureStore } from '@reduxjs/toolkit';
import onlineStatusReducer from './slices/onlineStatusSlice';
import profileReducer from './slices/profileSlice';

export const store = configureStore({
  reducer: {
    onlineStatus: onlineStatusReducer,
    profile: profileReducer,
    // Add other reducers here
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;