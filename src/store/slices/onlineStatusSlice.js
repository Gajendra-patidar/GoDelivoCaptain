import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isOnline: false,
  lastOnlineTime: null,
  onlineHistory: [],
  connectionType: null,
  isConnected: false,
};

const onlineStatusSlice = createSlice({
  name: 'onlineStatus',
  initialState,
  reducers: {
    setOnline: (state) => {
      state.isOnline = true;
      state.lastOnlineTime = new Date().toISOString();
      state.onlineHistory.push({
        status: 'online',
        timestamp: new Date().toISOString()
      });
    },
    
    setOffline: (state) => {
      state.isOnline = false;
      state.lastOnlineTime = new Date().toISOString();
      state.onlineHistory.push({
        status: 'offline',
        timestamp: new Date().toISOString()
      });
    },
    
    toggleOnlineStatus: (state) => {
      state.isOnline = !state.isOnline;
      state.lastOnlineTime = new Date().toISOString();
      state.onlineHistory.push({
        status: state.isOnline ? 'online' : 'offline',
        timestamp: new Date().toISOString()
      });
    },
    
    setConnectionType: (state, action) => {
      state.connectionType = action.payload;
    },
    
    setNetworkConnected: (state, action) => {
      state.isConnected = action.payload;
    },
    
    clearHistory: (state) => {
      state.onlineHistory = [];
    },
    
    resetOnlineStatus: () => initialState,
  },
});

// Export actions
export const {
  setOnline,
  setOffline,
  toggleOnlineStatus,
  setConnectionType,
  setNetworkConnected,
  clearHistory,
  resetOnlineStatus,
} = onlineStatusSlice.actions;

// Selectors
export const selectIsOnline = (state) => state.onlineStatus.isOnline;
export const selectLastOnlineTime = (state) => state.onlineStatus.lastOnlineTime;
export const selectOnlineHistory = (state) => state.onlineStatus.onlineHistory;
export const selectConnectionType = (state) => state.onlineStatus.connectionType;
export const selectIsConnected = (state) => state.onlineStatus.isConnected;

// Export reducer
export default onlineStatusSlice.reducer;