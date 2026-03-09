import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Platform,
  PermissionsAndroid,
  Alert,
  AppState,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import Geolocation from '@react-native-community/geolocation';
import {
  addNotification,
  completeOrder,
  createMockNearbyOrder,
} from '../../services/localDriverData';

const GOOGLE_MAPS_APIKEY = 'AIzaSyCgpFAvw-8Q8nHEHz4z5ztx449xZLkilyk';
const { width, height } = Dimensions.get('window');

const STAGES = {
  GOING_TO_PICKUP: 'GOING_TO_PICKUP',
  ARRIVED_PICKUP: 'ARRIVED_PICKUP',
  GOING_TO_DROP: 'GOING_TO_DROP',
  COMPLETED: 'COMPLETED',
};

const calculateDistance = (start, end) => {
  const earthRadius = 6371e3;
  const phi1 = (start.latitude * Math.PI) / 180;
  const phi2 = (end.latitude * Math.PI) / 180;
  const deltaPhi = ((end.latitude - start.latitude) * Math.PI) / 180;
  const deltaLambda = ((end.longitude - start.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const MapScreen = ({ navigation, route }) => {
  const order = useMemo(
    () => route?.params?.order || createMockNearbyOrder(),
    [route?.params?.order],
  );

  const pickup = useMemo(
    () =>
      order?.pickup || {
        latitude: 22.7196,
        longitude: 75.8577,
      },
    [order],
  );

  const drop = useMemo(
    () =>
      order?.drop || {
        latitude: 22.7533,
        longitude: 75.8937,
      },
    [order],
  );

  const pickupAddress = order?.pickupAddress || 'Pickup address unavailable';
  const dropAddress = order?.dropAddress || 'Drop address unavailable';

  const mapRef = useRef(null);
  const watchId = useRef(null);
  const appState = useRef(AppState.currentState);

  const [tripStage, setTripStage] = useState(STAGES.GOING_TO_PICKUP);
  const [driverCoords, setDriverCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [usingApproximateRoute, setUsingApproximateRoute] = useState(false);

  const destination = useMemo(() => {
    if (tripStage === STAGES.GOING_TO_PICKUP || tripStage === STAGES.ARRIVED_PICKUP) {
      return pickup;
    }
    if (tripStage === STAGES.GOING_TO_DROP) {
      return drop;
    }
    return null;
  }, [drop, pickup, tripStage]);

  const stopLocationTracking = useCallback(() => {
    if (watchId.current !== null) {
      Geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const startLocationTracking = useCallback(() => {
    Geolocation.getCurrentPosition(
      position => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setDriverCoords(coords);
        setIsLoading(false);
      },
      () => {
        setDriverCoords({
          latitude: pickup.latitude - 0.01,
          longitude: pickup.longitude - 0.01,
        });
        setLocationError('Using approximate location');
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000,
      },
    );

    watchId.current = Geolocation.watchPosition(
      position => {
        setDriverCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {},
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000,
      },
    );
  }, [pickup.latitude, pickup.longitude]);

  const requestLocationPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        const result = await Geolocation.requestAuthorization('whenInUse');
        const granted = result === 'granted';
        setHasPermission(granted);
        if (granted) {
          startLocationTracking();
        } else {
          setIsLoading(false);
          setLocationError('Location permission denied');
        }
        return;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs location access for live order navigation.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );

      const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
      setHasPermission(isGranted);
      if (isGranted) {
        startLocationTracking();
      } else {
        setIsLoading(false);
        setLocationError('Location permission denied');
      }
    } catch {
      setIsLoading(false);
      setLocationError('Could not access location services');
    }
  }, [startLocationTracking]);

  useEffect(() => {
    requestLocationPermission();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (hasPermission) {
          startLocationTracking();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      stopLocationTracking();
    };
  }, [hasPermission, requestLocationPermission, startLocationTracking, stopLocationTracking]);

  useEffect(() => {
    if (!driverCoords || !destination) {
      return;
    }

    const distanceInMeters = calculateDistance(driverCoords, destination);
    setDistance(distanceInMeters / 1000);

    if (usingApproximateRoute) {
      setDuration((distanceInMeters / 1000 / 25) * 60);
    }

    if (distanceInMeters <= 60 && tripStage === STAGES.GOING_TO_PICKUP) {
      setTripStage(STAGES.ARRIVED_PICKUP);
      Alert.alert('Arrived', 'You have reached pickup location. Confirm pickup now.');
    }
  }, [destination, driverCoords, tripStage, usingApproximateRoute]);

  const handleDirectionsReady = result => {
    setDistance(result.distance);
    setDuration(result.duration);
    setUsingApproximateRoute(false);

    if (mapRef.current && result.coordinates.length > 0) {
      mapRef.current.fitToCoordinates(result.coordinates, {
        edgePadding: {
          right: width / 20,
          bottom: height / 4,
          left: width / 20,
          top: height / 10,
        },
        animated: true,
      });
    }
  };

  const handleDirectionsError = () => {
    setUsingApproximateRoute(true);
  };

  const handlePickupConfirm = async () => {
    setTripStage(STAGES.GOING_TO_DROP);
    await addNotification({
      title: 'Pickup Confirmed',
      body: `${order.id} pickup confirmed. Navigate to drop.`,
      type: 'order',
      data: order,
    });
  };

  const handleCompleteDelivery = async () => {
    const completedOrder = await completeOrder({
      ...order,
      drop,
      pickup,
      pickupAddress,
      dropAddress,
      deliveredDistanceKm: distance,
    });

    await addNotification({
      title: 'Delivery Completed',
      body: `${completedOrder.id} completed. Earnings credited to wallet.`,
      type: 'order',
      data: completedOrder,
    });

    setTripStage(STAGES.COMPLETED);
    stopLocationTracking();

    Alert.alert('Delivery Complete', 'Order delivered successfully.', [
      {
        text: 'Go Home',
        onPress: () => navigation.navigate('MyTabs'),
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Fetching location...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Location permission denied</Text>
        <TouchableOpacity style={styles.retryButton} onPress={requestLocationPermission}>
          <Text style={styles.retryButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!driverCoords) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          ...driverCoords,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsMyLocationButton
        showsCompass
      >
        <Marker coordinate={driverCoords} title="You" />
        <Marker coordinate={pickup} title="Pickup" description={pickupAddress} />
        <Marker coordinate={drop} title="Drop" description={dropAddress} />

        {destination && GOOGLE_MAPS_APIKEY ? (
          <MapViewDirections
            origin={driverCoords}
            destination={destination}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={5}
            strokeColor="#0066cc"
            mode="DRIVING"
            onReady={handleDirectionsReady}
            onError={handleDirectionsError}
          />
        ) : null}
      </MapView>

      {locationError ? (
        <View style={[styles.banner, styles.locationBanner]}>
          <Text style={styles.bannerText}>{locationError}</Text>
        </View>
      ) : null}

      {usingApproximateRoute || !GOOGLE_MAPS_APIKEY ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Using approximate route. Add Google Directions API key for turn-by-turn path.
          </Text>
        </View>
      ) : null}

      <View style={styles.bottomCard}>
        <Text style={styles.orderId}>{order.id}</Text>
        <Text style={styles.status}>
          {tripStage === STAGES.GOING_TO_PICKUP && 'Navigating to pickup'}
          {tripStage === STAGES.ARRIVED_PICKUP && 'Arrived at pickup'}
          {tripStage === STAGES.GOING_TO_DROP && 'Navigating to drop'}
          {tripStage === STAGES.COMPLETED && 'Delivery completed'}
        </Text>

        <Text style={styles.address}>
          {tripStage === STAGES.GOING_TO_DROP ? `Drop: ${dropAddress}` : `Pickup: ${pickupAddress}`}
        </Text>

        {distance ? (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>Distance: {distance.toFixed(2)} km</Text>
            {duration ? (
              <Text style={styles.infoText}>ETA: {Math.ceil(duration)} mins</Text>
            ) : null}
          </View>
        ) : null}

        {(tripStage === STAGES.ARRIVED_PICKUP || tripStage === STAGES.GOING_TO_PICKUP) ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handlePickupConfirm}>
            <Text style={styles.primaryButtonText}>Pickup Confirmation</Text>
          </TouchableOpacity>
        ) : null}

        {tripStage === STAGES.GOING_TO_DROP ? (
          <TouchableOpacity style={styles.successButton} onPress={handleCompleteDelivery}>
            <Text style={styles.primaryButtonText}>Delivery Complete</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

export default MapScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  errorText: {
    fontSize: 18,
    color: '#ff4444',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  banner: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    backgroundColor: '#facc15',
    padding: 10,
    borderRadius: 8,
  },
  locationBanner: {
    top: 64,
    backgroundColor: '#93c5fd',
  },
  bannerText: {
    color: '#111827',
    fontSize: 12,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  orderId: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  status: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  address: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 6,
    marginBottom: 8,
  },
  infoContainer: {
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 10,
  },
  infoText: {
    color: '#374151',
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});

