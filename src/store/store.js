import { configureStore } from '@reduxjs/toolkit';
import onlineStatusReducer from './slices/onlineStatusSlice';
import profileReducer from './slices/profileSlice';
import permissionReducer from './slices/permissionSlice';

export const store = configureStore({
  reducer: {
    onlineStatus: onlineStatusReducer,
    profile: profileReducer,
    permission: permissionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;