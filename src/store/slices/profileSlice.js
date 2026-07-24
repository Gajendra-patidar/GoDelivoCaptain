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
      console.log("profile data", response);
      
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

// UPLOAD PROFILE IMAGE
export const uploadProfileImage = createAsyncThunk(
  'profile/uploadProfileImage',
  async (imageUri, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Missing user token');

      const formData = new FormData();
      formData.append('profileImage', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile_image.jpg',
      });

      const response = await axios.put(
        `${PROFILE_URL}/avatar`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      return response.data?.data?.profileImage || response.data?.profileImage || response.data?.data?.imageUrl || null;
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
    imageUploading: false,
    imageError: null,
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
      })

      // UPLOAD PROFILE IMAGE
      .addCase(uploadProfileImage.pending, state => {
        state.imageUploading = true;
        state.imageError = null;
      })
      .addCase(uploadProfileImage.fulfilled, (state, action) => {
        state.imageUploading = false;
        if (action.payload && state.profile) {
          state.profile = { ...state.profile, profileImage: action.payload };
        }
        state.imageError = null;
      })
      .addCase(uploadProfileImage.rejected, (state, action) => {
        state.imageUploading = false;
        state.imageError = action.payload;
      });
  },
});

export const { clearProfile, setProfile } = profileSlice.actions;

export const selectProfile = state => state.profile.profile;
export const selectProfileLoading = state => state.profile.loading;
export const selectProfileError = state => state.profile.error;
export const selectImageUploading = state => state.profile.imageUploading;
export const selectImageError = state => state.profile.imageError;

export default profileSlice.reducer;
