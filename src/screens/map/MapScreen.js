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
  Modal,
  TextInput,
  StatusBar,
  ScrollView,
  Linking,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Geolocation from '@react-native-community/geolocation';
import {
  addNotification,
  completeOrder,
  createMockNearbyOrder,
  setActiveOrder,
} from '../../services/localDriverData';
import { driverApi } from '../../services/driverApi';
import { theme } from '../../theme';
import { GOOGLE_MAPS_APIKEY } from '../../config/api';
const { width, height } = Dimensions.get('window');

const STAGES = {
  GOING_TO_PICKUP: 'GOING_TO_PICKUP',
  ARRIVED_PICKUP: 'ARRIVED_PICKUP',
  GOING_TO_DROP: 'GOING_TO_DROP',
  ARRIVED_DROP: 'ARRIVED_DROP',
  COMPLETED: 'COMPLETED',
};

const TRAVEL_MODES = {
  DRIVING: 'driving',
  WALKING: 'walking',
  BICYCLING: 'bicycling',
  TRANSIT: 'transit',
};

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// Manual distance calculation function (Haversine formula)
const calculateHaversineDistance = (start, end) => {
  if (!start || !end) return 0;
  
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (start.latitude * Math.PI) / 180;
  const φ2 = (end.latitude * Math.PI) / 180;
  const Δφ = ((end.latitude - start.latitude) * Math.PI) / 180;
  const Δλ = ((end.longitude - start.longitude) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in meters
};

const calculateBearing = (start, end) => {
  if (!start || !end) return 0;
  
  const lat1 = start.latitude * Math.PI / 180;
  const lat2 = end.latitude * Math.PI / 180;
  const lng1 = start.longitude * Math.PI / 180;
  const lng2 = end.longitude * Math.PI / 180;
  
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

// Function to fetch shortest path from Google Maps API
const fetchShortestPath = async (origin, destination, mode = TRAVEL_MODES.DRIVING) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=${mode}&alternatives=true&key=${GOOGLE_MAPS_APIKEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      // Sort routes by distance to find the shortest
      const routesWithDistance = data.routes.map(route => {
        const distance = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);
        const duration = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0);
        const polyline = route.overview_polyline.points;
        
        // Decode polyline to coordinates
        const coordinates = decodePolyline(polyline);
        
        return {
          ...route,
          distance,
          duration,
          coordinates,
          summary: route.summary,
        };
      });
      
      // Sort by distance (shortest first)
      routesWithDistance.sort((a, b) => a.distance - b.distance);
      
      return {
        routes: routesWithDistance,
        shortestRoute: routesWithDistance[0],
        alternativeRoutes: routesWithDistance.slice(1),
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching shortest path:', error);
    return null;
  }
};

// Polyline decoder function
const decodePolyline = (encoded) => {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    points.push({
      latitude: (lat / 1e5),
      longitude: (lng / 1e5),
    });
  }
  return points;
};

const MapScreen = ({ navigation, route }) => {
  // Memoized values
  const order = useMemo(
    () => route?.params?.order || createMockNearbyOrder(),
    [route?.params?.order],
  );

  const pickup = useMemo(
    () =>
      order?.pickup || {
        latitude: 22.7261,
        longitude: 75.8931,
      },
    [order],
  );

  const drop = useMemo(
    () =>
      order?.drop || {
        latitude: 22.7203,
        longitude: 75.9059,
      },
    [order],
  );

  const pickupAddress = useMemo(
    () => order?.pickupAddress || 'Pickup address unavailable',
    [order?.pickupAddress]
  );
  
  const dropAddress = useMemo(
    () => order?.dropAddress || 'Drop address unavailable',
    [order?.dropAddress]
  );

  // Refs
  const mapRef = useRef(null);
  const watchId = useRef(null);
  const appState = useRef(AppState.currentState);
  const directionInterval = useRef(null);
  const lastKnownCoords = useRef(null);

  // State
  const [tripStage, setTripStage] = useState(STAGES.GOING_TO_PICKUP);
  const [driverCoords, setDriverCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [usingApproximateRoute, setUsingApproximateRoute] = useState(false);
  const [showDropRoute, setShowDropRoute] = useState(false);
  const [arrowRotation, setArrowRotation] = useState(0);
  const [nextWaypoint, setNextWaypoint] = useState(null);
  
  // Route optimization states
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState([]);
  const [showRouteOptions, setShowRouteOptions] = useState(false);
  const [travelMode, setTravelMode] = useState(TRAVEL_MODES.DRIVING);
  const [isFetchingRoutes, setIsFetchingRoutes] = useState(false);
  
  // Modal states
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashCollected, setCashCollected] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalError, setModalError] = useState('');

  // Cancel trip states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Pickup OTP states
  const [showPickupOtpModal, setShowPickupOtpModal] = useState(false);
  const [pickupOtp, setPickupOtp] = useState('');

  // Memoized destination
  const destination = useMemo(() => {
    if (tripStage === STAGES.GOING_TO_PICKUP || tripStage === STAGES.ARRIVED_PICKUP) {
      return pickup;
    }
    if (tripStage === STAGES.GOING_TO_DROP || tripStage === STAGES.ARRIVED_DROP) {
      return drop;
    }
    return null;
  }, [drop, pickup, tripStage]);

  // Initialize from order status
  useEffect(() => {
    try {
      const status = String(order?.status || '').toLowerCase();
      if (status === 'picked_up' || status === 'pickedup') {
        setTripStage(STAGES.GOING_TO_DROP);
        setShowDropRoute(true);
      } else {
        setTripStage(STAGES.GOING_TO_PICKUP);
        setShowDropRoute(false);
      }
    } catch (error) {
      console.error('Error setting initial stage:', error);
    }
  }, [order?.status]);

  // Fetch shortest path when destination changes
  useEffect(() => {
    if (driverCoords && destination && GOOGLE_MAPS_APIKEY) {
      fetchAndDisplayShortestPath();
    }
  }, [driverCoords, destination, travelMode]);

  const fetchAndDisplayShortestPath = async () => {
    if (!driverCoords || !destination) return;
    
    setIsFetchingRoutes(true);
    try {
      const result = await fetchShortestPath(driverCoords, destination, travelMode);
      
      if (result) {
        setRoutes(result.routes);
        setSelectedRoute(result.shortestRoute);
        setAlternativeRoutes(result.alternativeRoutes);
        
        // Update distance and duration with shortest route
        if (result.shortestRoute) {
          setDistance(result.shortestRoute.distance / 1000); // Convert to km
          setDuration(Math.round(result.shortestRoute.duration / 60)); // Convert to minutes
          setUsingApproximateRoute(false);
          
          // Fit map to show the selected route
          if (mapRef.current && result.shortestRoute.coordinates.length > 0) {
            mapRef.current.fitToCoordinates(result.shortestRoute.coordinates, {
              edgePadding: {
                top: 50,
                right: 50,
                bottom: 200,
                left: 50,
              },
              animated: true,
            });
          }
        }
      } else {
        setUsingApproximateRoute(true);
      }
    } catch (error) {
      console.error('Error fetching routes:', error);
      setUsingApproximateRoute(true);
    } finally {
      setIsFetchingRoutes(false);
    }
  };

  // Calculate arrow rotation based on next waypoint
  const updateArrowRotation = useCallback(() => {
    if (!driverCoords || !destination) return;

    try {
      if (selectedRoute && selectedRoute.coordinates && selectedRoute.coordinates.length > 1) {
        // Find the closest point on route to current location
        let closestIndex = 0;
        let closestDistance = Infinity;
        
        selectedRoute.coordinates.forEach((point, index) => {
          const dist = calculateHaversineDistance(driverCoords, point);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestIndex = index;
          }
        });
        
        // Get next point (if available)
        const nextIndex = Math.min(closestIndex + 1, selectedRoute.coordinates.length - 1);
        const nextPoint = selectedRoute.coordinates[nextIndex] || destination;
        
        const bearing = calculateBearing(driverCoords, nextPoint);
        setArrowRotation(bearing);
        setNextWaypoint(nextPoint);
      } else {
        // Fallback to direct destination bearing
        const bearing = calculateBearing(driverCoords, destination);
        setArrowRotation(bearing);
        setNextWaypoint(null);
      }
    } catch (error) {
      console.error('Error updating arrow rotation:', error);
    }
  }, [driverCoords, destination, selectedRoute]);

  // Continuous direction updates
  useEffect(() => {
    if (driverCoords && destination) {
      updateArrowRotation();
      
      directionInterval.current = setInterval(updateArrowRotation, 1000);
      
      return () => {
        if (directionInterval.current) {
          clearInterval(directionInterval.current);
        }
      };
    }
  }, [driverCoords, destination, updateArrowRotation]);

  // Optimized 3D camera view
  const updateCamera3D = useCallback((coords, heading = 0, animated = true) => {
    if (!mapRef.current || !coords) return;

    try {
      const tilt = tripStage === STAGES.GOING_TO_DROP || tripStage === STAGES.ARRIVED_DROP ? 65 : 50;
      
      const camera = {
        center: coords,
        pitch: tilt,
        heading: heading || arrowRotation || 0,
        altitude: 600,
        zoom: 18,
      };

      if (animated) {
        mapRef.current.animateCamera(camera, { duration: 500 });
      } else {
        mapRef.current.setCamera(camera);
      }
    } catch (error) {
      console.error('Error updating camera:', error);
    }
  }, [tripStage, arrowRotation]);

  // Follow driver with optimized 3D view
  useEffect(() => {
    if (driverCoords && (
      tripStage === STAGES.GOING_TO_PICKUP || 
      tripStage === STAGES.GOING_TO_DROP ||
      tripStage === STAGES.ARRIVED_DROP
    )) {
      updateCamera3D(driverCoords, arrowRotation);
    }
  }, [driverCoords, tripStage, arrowRotation, updateCamera3D]);

  const stopLocationTracking = useCallback(() => {
    try {
      if (watchId.current !== null) {
        Geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (directionInterval.current) {
        clearInterval(directionInterval.current);
      }
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }, []);

  const startLocationTracking = useCallback(() => {
    try {
      Geolocation.getCurrentPosition(
        position => {
          try {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setDriverCoords(coords);
            lastKnownCoords.current = coords;
            setIsLoading(false);
            
            setTimeout(() => {
              if (mapRef.current) {
                updateCamera3D(coords, 0, false);
              }
            }, 500);
          } catch (error) {
            console.error('Error processing position:', error);
          }
        },
        error => {
          console.error('Location error:', error);
          setDriverCoords({
            latitude: pickup.latitude - 0.01,
            longitude: pickup.longitude - 0.01,
          });
          setLocationError('Using approximate location');
          setIsLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        },
      );

      watchId.current = Geolocation.watchPosition(
        position => {
          try {
            const newCoords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            
            setDriverCoords(newCoords);
            lastKnownCoords.current = newCoords;
          } catch (error) {
            console.error('Error processing watch position:', error);
          }
        },
        error => console.log('Watch error:', error),
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 5000,
          fastestInterval: 3000,
        },
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setIsLoading(false);
      setLocationError('Could not start location tracking');
    }
  }, [pickup.latitude, pickup.longitude, updateCamera3D]);

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
          message: 'This app needs location access for live order navigation with 3D maps.',
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
    } catch (error) {
      console.error('Permission error:', error);
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
  }, [hasPermission, startLocationTracking, stopLocationTracking]);

  // Fixed distance calculation using Haversine formula
  useEffect(() => {
    if (!driverCoords || !destination) return;

    try {
      const distanceInMeters = calculateHaversineDistance(driverCoords, destination);
      
      if (!isNaN(distanceInMeters) && distanceInMeters >= 0) {
        // Only update distance if we don't have a route-based distance
        if (!selectedRoute) {
          setDistance(distanceInMeters / 1000);
        }

        // Arrived at pickup
        if (distanceInMeters <= 60 && tripStage === STAGES.GOING_TO_PICKUP) {
          setTripStage(STAGES.ARRIVED_PICKUP);
          
          if (mapRef.current) {
            updateCamera3D(pickup, 0);
          }
          
          Alert.alert('📍 Arrived', 'You have reached pickup location. Confirm pickup now.');
        }
        
        // Arrived at drop
        if (distanceInMeters <= 50 && tripStage === STAGES.GOING_TO_DROP) {
          setTripStage(STAGES.ARRIVED_DROP);
          
          if (mapRef.current) {
            updateCamera3D(drop, 0);
          }
          
          Alert.alert('🎯 Arrived', 'You have reached the destination. Complete delivery when ready.');
        }
      }
    } catch (error) {
      console.error('Error calculating distance:', error);
      setDistance(null);
    }
  }, [destination, driverCoords, tripStage, pickup, drop, updateCamera3D, selectedRoute]);

  const handleSelectRoute = (route) => {
    setSelectedRoute(route);
    setDistance(route.distance / 1000);
    setDuration(Math.round(route.duration / 60));
    setShowRouteOptions(false);
    
    if (mapRef.current && route.coordinates.length > 0) {
      mapRef.current.fitToCoordinates(route.coordinates, {
        edgePadding: {
          top: 50,
          right: 50,
          bottom: 200,
          left: 50,
        },
        animated: true,
      });
    }
  };

  const handleCallCustomer = () => {
    const phone = order?.customerPhone || order?.customer?.phone;
    if (!phone) {
      Alert.alert('No phone number', 'Customer phone number is not available for this order.');
      return;
    }
    const url = `tel:${phone}`;
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Cannot make call', `Unable to call customer. Please dial ${phone} manually.`);
        }
      })
      .catch(() => {
        Alert.alert('Error', 'Failed to initiate call.');
      });
  };

  const handleCancelTrip = async () => {
    if (!cancelReason) {
      Alert.alert('Select reason', 'Please select a reason for cancellation.');
      return;
    }

    setIsCancelling(true);
    try {
      await driverApi.cancelOrder(order.id, cancelReason);
    } catch {
      // Proceed even if backend fails — clear local state
    }

    await clearActiveOrder();
    await addNotification({
      title: 'Trip Cancelled',
      body: `Order ${order.id} cancelled: ${cancelReason}`,
      type: 'order',
      data: order,
    });

    setIsCancelling(false);
    setShowCancelModal(false);
    setCancelReason('');
    stopLocationTracking();
    navigation.navigate('MyTabs');
  };

  const handlePickupOtpSubmit = () => {
    const expectedCode = order?.pickupCode || order?.otp || order?.pickup_otp;
    // If no OTP is set by backend, allow any 4-digit code
    if (expectedCode && pickupOtp !== String(expectedCode)) {
      Alert.alert('Invalid Code', 'The pickup verification code is incorrect. Please check with the customer.');
      return;
    }
    if (pickupOtp.length < 4) {
      Alert.alert('Enter Code', 'Please enter the 4-digit pickup verification code.');
      return;
    }
    setShowPickupOtpModal(false);
    setPickupOtp('');
    handlePickupConfirmActual();
  };

  const handlePickupConfirm = () => {
    setPickupOtp('');
    setShowPickupOtpModal(true);
  };

  const handlePickupConfirmActual = async () => {
    try {
      setTripStage(STAGES.GOING_TO_DROP);
      setShowDropRoute(true);

      const updated = await driverApi.confirmPickup(order.id).catch(() => null);
      
      if (updated) {
        await setActiveOrder(updated);
      } else {
        await setActiveOrder({ ...order, status: 'picked_up' });
      }

      await addNotification({
        title: 'Pickup Confirmed',
        body: `${order.id} pickup confirmed. Navigate to drop.`,
        type: 'order',
        data: { ...order, status: 'picked_up' },
      });

      if (mapRef.current && driverCoords) {
        updateCamera3D(driverCoords, arrowRotation);
      }
      
      // Fetch shortest path for drop
      if (driverCoords && drop) {
        fetchAndDisplayShortestPath();
      }
    } catch (error) {
      console.error('Pickup confirmation error:', error);
      Alert.alert('Error', 'Failed to confirm pickup. Please try again.');
    }
  };

  const handleCashCollected = async () => {
    try {
      if (paymentMethod === 'cash') {
        if (!cashCollected) {
          setModalError('Please enter the amount collected');
          return;
        }
        const amountValue = parseFloat(cashCollected);
        if (isNaN(amountValue) || amountValue <= 0) {
          setModalError('Please enter a valid amount');
          return;
        }
      }

      setModalError('');
      setIsProcessing(true);

      const amount = paymentMethod === 'cash' ? parseFloat(cashCollected) : (order?.amount || 0);
      
      let serverCompleted = null;
      try {
        serverCompleted = await driverApi.completeOrder(order.id, distance || 0, {
          amount,
          paymentMethod,
        });
      } catch (error) {
        console.log('Completion sync failed (offline mode):', error);
      }

      const completedOrder = await completeOrder({
        ...order,
        ...(serverCompleted || {}),
        drop,
        pickup,
        pickupAddress,
        dropAddress,
        deliveredDistanceKm: distance,
        amount,
        paymentMethod,
        completedAt: new Date().toISOString(),
      });

      await addNotification({
        title: 'Delivery Completed',
        body: `${completedOrder.id} completed. ₹${amount} collected via ${paymentMethod}.`,
        type: 'order',
        data: completedOrder,
      });

      setTripStage(STAGES.COMPLETED);
      stopLocationTracking();
      setShowCashModal(false);

      Alert.alert(
        '✅ Delivery Complete', 
        `Order delivered successfully. ₹${amount} collected.`,
        [
          {
            text: 'Go Home',
            onPress: () => navigation.navigate('MyTabs'),
          },
        ]
      );
    } catch (error) {
      console.error('Completion error:', error);
      setModalError('Failed to complete delivery. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteDelivery = () => {
    setCashCollected(order?.amount?.toString() || '');
    setPaymentMethod('cash');
    setModalError('');
    setShowCashModal(true);
  };

  // Loading states
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>📍 Location permission denied</Text>
        <Text style={styles.errorSubtext}>Please enable location access to continue</Text>
        <TouchableOpacity style={styles.retryButton} onPress={requestLocationPermission}>
          <Text style={styles.retryButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!driverCoords) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Waiting for location...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: driverCoords.latitude,
            longitude: driverCoords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={false}
          showsMyLocationButton={true}
          showsCompass={true}
          showsBuildings={true}
          showsTraffic={true}
          showsIndoors={true}
          showsScale={true}
          loadingEnabled={true}
          loadingIndicatorColor={theme.colors.primary}
          loadingBackgroundColor="#f5f5f5"
          moveOnMarkerPress={false}
          toolbarEnabled={false}
        >
          {/* Direction Arrow Marker with Auto-rotation */}
          <Marker
            coordinate={driverCoords}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
            rotation={arrowRotation}
          >
            <View style={styles.arrowContainer}>
              <View style={[styles.arrow, { transform: [{ rotate: `${arrowRotation}deg` }] }]}>
                <View style={styles.arrowHead} />
                <View style={styles.arrowLine} />
                <View style={styles.arrowGlow} />
              </View>
              <View style={styles.arrowPulse} />
            </View>
          </Marker>

          {/* Pickup Marker */}
          <Marker coordinate={pickup} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.pickupMarker}>
              <Text style={styles.markerText}>P</Text>
              <View style={styles.markerPulse} />
            </View>
          </Marker>

          {/* Drop Marker */}
          {showDropRoute && (
            <Marker coordinate={drop} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.dropMarker}>
                <Text style={styles.markerText}>D</Text>
                <View style={styles.markerPulse} />
              </View>
            </Marker>
          )}

          {/* Next Waypoint Indicator */}
          {nextWaypoint && showDropRoute && (
            <Marker coordinate={nextWaypoint} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.waypointMarker}>
                <View style={styles.waypointDot} />
              </View>
            </Marker>
          )}

          {/* Selected Route Polyline */}
          {selectedRoute && selectedRoute.coordinates && (
            <Polyline
              coordinates={selectedRoute.coordinates}
              strokeWidth={6}
              strokeColor={showDropRoute ? theme.colors.path : theme.colors.primary}
              lineDashPattern={[0]}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Alternative Routes (dashed lines) */}
          {alternativeRoutes.map((route, index) => (
            <Polyline
              key={`alt-route-${index}`}
              coordinates={route.coordinates}
              strokeWidth={3}
              strokeColor="rgba(100, 100, 100, 0.5)"
              lineDashPattern={[10, 5]}
              lineCap="round"
              lineJoin="round"
            />
          ))}
        </MapView>

        {/* Route Info and Selection Button */}
        {selectedRoute && (
          <TouchableOpacity
            style={styles.routeInfoButton}
            onPress={() => setShowRouteOptions(!showRouteOptions)}
          >
            <View style={styles.routeInfoContent}>
              <Text style={styles.routeInfoTitle}>
                {showDropRoute ? '📍 Shortest Route to Drop' : '📍 Shortest Route to Pickup'}
              </Text>
              <Text style={styles.routeInfoDetails}>
                {selectedRoute.distance / 1000 < 1 
                  ? `${Math.round(selectedRoute.distance)} m` 
                  : `${(selectedRoute.distance / 1000).toFixed(1)} km`} • 
                {Math.round(selectedRoute.duration / 60)} min • 
                {selectedRoute.summary || 'via fastest route'}
              </Text>
            </View>
            <Text style={styles.routeInfoArrow}>▼</Text>
          </TouchableOpacity>
        )}

        {/* Route Options Modal */}
        <Modal
          visible={showRouteOptions}
          transparent
          animationType="slide"
          onRequestClose={() => setShowRouteOptions(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.routeModalContent]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🛣️ Select Route</Text>
                <TouchableOpacity onPress={() => setShowRouteOptions(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.travelModeContainer}>
                <Text style={styles.travelModeLabel}>Travel Mode:</Text>
                <View style={styles.travelModeButtons}>
                  {Object.values(TRAVEL_MODES).map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.travelModeButton,
                        travelMode === mode && styles.travelModeButtonActive,
                      ]}
                      onPress={() => setTravelMode(mode)}
                    >
                      <Text style={[
                        styles.travelModeButtonText,
                        travelMode === mode && styles.travelModeButtonTextActive,
                      ]}>
                        {mode === 'driving' && '🚗'}
                        {mode === 'walking' && '🚶'}
                        {mode === 'bicycling' && '🚲'}
                        {mode === 'transit' && '🚌'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <ScrollView style={styles.routesList}>
                {isFetchingRoutes ? (
                  <View style={styles.loadingRoutes}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.loadingRoutesText}>Finding best routes...</Text>
                  </View>
                ) : (
                  routes.map((route, index) => (
                    <TouchableOpacity
                      key={`route-${index}`}
                      style={[
                        styles.routeOption,
                        selectedRoute === route && styles.routeOptionSelected,
                      ]}
                      onPress={() => handleSelectRoute(route)}
                    >
                      <View style={styles.routeOptionHeader}>
                        <Text style={styles.routeOptionTitle}>
                          {index === 0 ? '⭐ Shortest Route' : `🔄 Alternative ${index}`}
                        </Text>
                        {selectedRoute === route && (
                          <Text style={styles.routeOptionCheck}>✓</Text>
                        )}
                      </View>
                      <Text style={styles.routeOptionSummary}>
                        {route.summary || 'via main roads'}
                      </Text>
                      <View style={styles.routeOptionDetails}>
                        <Text style={styles.routeOptionDistance}>
                          📏 {(route.distance / 1000).toFixed(1)} km
                        </Text>
                        <Text style={styles.routeOptionDuration}>
                          ⏱️ {Math.round(route.duration / 60)} min
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Error Banners */}
        {locationError && (
          <View style={[styles.banner, styles.locationBanner]}>
            <Text style={styles.bannerText}>⚠️ {locationError}</Text>
          </View>
        )}

        {usingApproximateRoute && !selectedRoute && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              ⚠️ Using approximate route. Tap route info to find shortest path.
            </Text>
          </View>
        )}

        {/* Bottom Card */}
        <View style={styles.bottomCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.orderId}>Order #{order.id}</Text>
            <View style={styles.cardHeaderActions}>
              {(order?.customerPhone || order?.customer?.phone) && (
                <TouchableOpacity style={styles.callButton} onPress={handleCallCustomer}>
                  <Ionicons name="call" size={18} color="#fff" />
                </TouchableOpacity>
              )}
              {(tripStage === STAGES.GOING_TO_PICKUP || tripStage === STAGES.ARRIVED_PICKUP) && (
                <TouchableOpacity style={styles.cancelTripButton} onPress={() => setShowCancelModal(true)}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.danger} />
                </TouchableOpacity>
              )}
              <View style={styles.stageBadge}>
                <Text style={styles.stageBadgeText}>
                  {tripStage === STAGES.GOING_TO_PICKUP && '🚗 To Pickup'}
                  {tripStage === STAGES.ARRIVED_PICKUP && '📍 At Pickup'}
                  {tripStage === STAGES.GOING_TO_DROP && '🚚 To Drop'}
                  {tripStage === STAGES.ARRIVED_DROP && '🎯 At Drop'}
                  {tripStage === STAGES.COMPLETED && '✅ Completed'}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.address} numberOfLines={2}>
            {tripStage === STAGES.GOING_TO_DROP || tripStage === STAGES.ARRIVED_DROP 
              ? `📦 Drop: ${dropAddress}` 
              : `📦 Pickup: ${pickupAddress}`}
          </Text>

          {distance !== null && (
            <View style={styles.infoContainer}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Distance</Text>
                <Text style={styles.infoValue}>
                  {distance < 1 
                    ? `${Math.round(distance * 1000)} m` 
                    : `${distance.toFixed(1)} km`}
                </Text>
              </View>
              {duration !== null && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>ETA</Text>
                  <Text style={styles.infoValue}>{duration} min</Text>
                </View>
              )}
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Amount</Text>
                <Text style={styles.infoValue}>₹{order?.amount || 0}</Text>
              </View>
            </View>
          )}

          {tripStage === STAGES.ARRIVED_PICKUP && (
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton]} 
              onPress={handlePickupConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>✅ Confirm Pickup</Text>
            </TouchableOpacity>
          )}

          {tripStage === STAGES.ARRIVED_DROP && (
            <TouchableOpacity 
              style={[styles.button, styles.successButton]} 
              onPress={handleCompleteDelivery}
              activeOpacity={0.8}
            >
              <Text style={styles.successButtonText}>💰 Complete & Collect Payment</Text>
            </TouchableOpacity>
          )}

          {(tripStage === STAGES.GOING_TO_PICKUP || tripStage === STAGES.GOING_TO_DROP) && (
            <View style={styles.drivingIndicator}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.drivingText}>
                {tripStage === STAGES.GOING_TO_PICKUP ? 'Heading to pickup...' : 'Heading to drop...'}
              </Text>
            </View>
          )}
        </View>

        {/* Cancel Trip Modal */}
        <Modal
          visible={showCancelModal}
          transparent
          animationType="slide"
          onRequestClose={() => !isCancelling && setShowCancelModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Cancel Trip</Text>
                <TouchableOpacity onPress={() => !isCancelling && setShowCancelModal(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cancelSubtext}>Select a reason for cancellation:</Text>
              {['Vehicle breakdown', 'Customer not reachable', 'Wrong address', 'Personal emergency', 'Other'].map(reason => (
                <TouchableOpacity
                  key={reason}
                  style={[styles.cancelReasonItem, cancelReason === reason && styles.cancelReasonActive]}
                  onPress={() => setCancelReason(reason)}
                  disabled={isCancelling}
                >
                  <Ionicons
                    name={cancelReason === reason ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={cancelReason === reason ? theme.colors.danger : '#999'}
                  />
                  <Text style={[styles.cancelReasonText, cancelReason === reason && styles.cancelReasonTextActive]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.button, styles.dangerButton, isCancelling && styles.disabledButton]}
                onPress={handleCancelTrip}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.successButtonText}>Cancel Trip</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Pickup OTP Modal */}
        <Modal
          visible={showPickupOtpModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPickupOtpModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Pickup Verification</Text>
                <TouchableOpacity onPress={() => setShowPickupOtpModal(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cancelSubtext}>Enter the 4-digit code provided by the customer to verify pickup:</Text>
              <TextInput
                style={styles.otpInput}
                value={pickupOtp}
                onChangeText={setPickupOtp}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="0000"
                placeholderTextColor="#ccc"
                textAlign="center"
              />
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handlePickupOtpSubmit}
              >
                <Text style={styles.primaryButtonText}>✅ Verify & Confirm Pickup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Cash Collection Modal */}
        <Modal
          visible={showCashModal}
          transparent
          animationType="slide"
          onRequestClose={() => !isProcessing && setShowCashModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>💰 Payment Collection</Text>
                <TouchableOpacity 
                  onPress={() => !isProcessing && setShowCashModal(false)}
                  disabled={isProcessing}
                >
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.orderSummary}>
                <Text style={styles.summaryText}>Order #{order.id}</Text>
                <Text style={styles.summaryText}>
                  Distance: {distance ? (distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`) : '0 km'}
                </Text>
              </View>

              <View style={styles.paymentMethods}>
                {['cash', 'card', 'online'].map(method => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.paymentMethod,
                      paymentMethod === method && styles.paymentMethodActive,
                    ]}
                    onPress={() => {
                      setPaymentMethod(method);
                      setModalError('');
                    }}
                    disabled={isProcessing}
                  >
                    <Text style={[
                      styles.paymentMethodText,
                      paymentMethod === method && styles.paymentMethodTextActive,
                    ]}>
                      {method === 'cash' && '💵 Cash'}
                      {method === 'card' && '💳 Card'}
                      {method === 'online' && '📱 Online'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {paymentMethod === 'cash' && (
                <View style={styles.amountInputContainer}>
                  <Text style={styles.amountLabel}>Amount Collected (₹)</Text>
                  <TextInput
                    style={[styles.amountInput, modalError && styles.inputError]}
                    value={cashCollected}
                    onChangeText={text => {
                      setCashCollected(text);
                      setModalError('');
                    }}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    placeholderTextColor="#999"
                    editable={!isProcessing}
                  />
                </View>
              )}

              {paymentMethod !== 'cash' && (
                <View style={styles.amountDisplay}>
                  <Text style={styles.amountDisplayLabel}>Amount to collect:</Text>
                  <Text style={styles.amountDisplayValue}>₹{order?.amount || 0}</Text>
                </View>
              )}

              {modalError ? (
                <Text style={styles.modalErrorText}>{modalError}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.collectButton,
                  isProcessing && styles.disabledButton,
                ]}
                onPress={handleCashCollected}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.collectButtonText}>
                    {paymentMethod === 'cash' ? '✅ Cash Collected' : '✅ Confirm Payment'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff4444',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  banner: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: theme.colors.primary,
    padding: 12,
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  locationBanner: {
    backgroundColor: '#93c5fd',
  },
  bannerText: {
    color: '#111827',
    fontSize: 13,
    textAlign: 'center',
  },
  routeInfoButton: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  routeInfoContent: {
    flex: 1,
  },
  routeInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  routeInfoDetails: {
    fontSize: 12,
    color: '#6B7280',
  },
  routeInfoArrow: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 8,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelTripButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderId: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  stageBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stageBadgeText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  address: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
    lineHeight: 20,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  successButton: {
    backgroundColor: theme.colors.success,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  successButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: theme.colors.danger,
  },
  cancelSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 14,
  },
  cancelReasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  cancelReasonActive: {
    backgroundColor: '#FEE2E2',
  },
  cancelReasonText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#374151',
  },
  cancelReasonTextActive: {
    fontWeight: '600',
    color: theme.colors.danger,
  },
  otpInput: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 20,
    letterSpacing: 12,
  },
  drivingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  drivingText: {
    marginLeft: 8,
    color: '#6B7280',
    fontSize: 14,
  },
  // Arrow Marker Styles
  arrowContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowHead: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#3B82F6',
    position: 'absolute',
    top: -5,
  },
  arrowLine: {
    width: 6,
    height: 25,
    backgroundColor: '#3B82F6',
    position: 'absolute',
    top: 10,
    borderRadius: 3,
  },
  arrowGlow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    position: 'absolute',
  },
  arrowPulse: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    position: 'absolute',
    transform: [{ scale: 1.2 }],
  },
  pickupMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  dropMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  markerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  markerPulse: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.3)',
    transform: [{ scale: 1.2 }],
  },
  waypointMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    borderWidth: 2,
    borderColor: '#fff',
  },
  waypointDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    position: 'absolute',
    top: 2,
    left: 2,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  routeModalContent: {
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    fontSize: 24,
    color: '#9CA3AF',
    padding: 4,
  },
  travelModeContainer: {
    marginBottom: 20,
  },
  travelModeLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    fontWeight: '600',
  },
  travelModeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  travelModeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  travelModeButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  travelModeButtonText: {
    fontSize: 24,
  },
  travelModeButtonTextActive: {
    color: '#fff',
  },
  routesList: {
    maxHeight: height * 0.4,
  },
  loadingRoutes: {
    padding: 40,
    alignItems: 'center',
  },
  loadingRoutesText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 14,
  },
  routeOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  routeOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  routeOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  routeOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  routeOptionCheck: {
    fontSize: 18,
    color: theme.colors.success,
    fontWeight: 'bold',
  },
  routeOptionSummary: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  routeOptionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  routeOptionDistance: {
    fontSize: 13,
    color: '#374151',
  },
  routeOptionDuration: {
    fontSize: 13,
    color: '#374151',
  },
  orderSummary: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  summaryText: {
    fontSize: 14,
    color: '#4B5563',
    marginVertical: 2,
  },
  paymentMethods: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  paymentMethod: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  paymentMethodActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  paymentMethodText: {
    fontSize: 13,
    color: '#6B7280',
  },
  paymentMethodTextActive: {
    color: theme.colors.ink,
    fontWeight: '600',
  },
  amountInputContainer: {
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    fontWeight: '600',
  },
  amountInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  inputError: {
    borderColor: '#ff4444',
  },
  amountDisplay: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountDisplayLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  amountDisplayValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.success,
  },
  collectButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  collectButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  modalErrorText: {
    color: '#ff4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
});

export default MapScreen;