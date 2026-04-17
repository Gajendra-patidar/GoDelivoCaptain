import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../services/api';

const PROFILE_URL = `${BASE_URL}/profile`;

const extractProfile = payload => {
  return (
    payload?.data?.profile ||
    payload?.data?.user ||
    payload?.profile ||
    payload?.user ||
    payload?.data ||
    payload ||
    null
  );
};

const errorMessage = error => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Something went wrong'
  );
};

const withAuth = async () => {
  const token = await AsyncStorage.getItem('userToken');
  if (!token) {
    throw new Error('Missing user token. Please login again.');
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

// GET PROFILE (Auth Mobile)
export const getProfile = createAsyncThunk(
  'profile/getProfile',
  async (_, { rejectWithValue }) => {
    try {
      const config = await withAuth();
      const response = await axios.get(PROFILE_URL, config);
      return extractProfile(response.data);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

// UPDATE PROFILE (Auth Mobile)
export const updateProfile = createAsyncThunk(
  'profile/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const config = await withAuth();
      const response = await axios.put(
        PROFILE_URL,
        profileData,
        config
      );
      return extractProfile(response.data);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

const profileSlice = createSlice({
  name: 'profile',
  initialState: {
    profile: null,
    loading: false,
    error: null,
  },

  reducers: {
    clearProfile: state => {
      state.profile = null;
      state.loading = false;
      state.error = null;
    },
    setProfile: (state, action) => {
      state.profile = action.payload || null;
      state.error = null;
    },
  },

  extraReducers: builder => {
    builder

      // GET PROFILE
      .addCase(getProfile.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
        state.error = null;
      })
      .addCase(getProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // UPDATE PROFILE
      .addCase(updateProfile.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        const next = action.payload;
        if (
          next &&
          typeof next === 'object' &&
          !Array.isArray(next) &&
          state.profile &&
          typeof state.profile === 'object' &&
          !Array.isArray(state.profile)
        ) {
          state.profile = { ...state.profile, ...next };
        } else {
          state.profile = next;
        }
        state.error = null;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearProfile, setProfile } = profileSlice.actions;

export const selectProfile = state => state.profile.profile;
export const selectProfileLoading = state => state.profile.loading;
export const selectProfileError = state => state.profile.error;

export default profileSlice.reducer;
