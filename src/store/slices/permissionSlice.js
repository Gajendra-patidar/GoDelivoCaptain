import {createSlice} from '@reduxjs/toolkit';

const permissionSlice = createSlice({
  name: 'permission',
  initialState: {
    locationGranted: false,
  },
  reducers: {
    setLocationPermission: (state, action) => {
      state.locationGranted = action.payload;
    },
  },
});

export const {setLocationPermission} = permissionSlice.actions;
export default permissionSlice.reducer;