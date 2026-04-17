import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
  AppState,
  ActivityIndicator,
  Modal,
  TextInput,
  StatusBar,
  ScrollView,
  Linking,
  Easing,
  Animated,
  Image,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { moderateScale } from 'react-native-size-matters';
import MapViewDirections from 'react-native-maps-directions';
import Geolocation from '@react-native-community/geolocation';
import {
  addNotification,
  completeOrder,
  createMockNearbyOrder,
  setActiveOrder,
} from '../../services/localDriverData';
import { driverApi } from '../../services/driverApi';
import SocketService from '../../services/socketService';
import { theme } from '../../theme';
import { GOOGLE_MAPS_APIKEY } from '../../config/api';
import {
  updateService,
  updateServiceBody,
} from '../../services/foregroundService';
import { useDispatch, useSelector } from 'react-redux';
import { setLocationPermission } from '../../store/slices/permissionSlice';
import { selectProfile } from '../../store/slices/profileSlice';
import { getLocationPermission } from '../../services/permissionService';

import imgPath from '../../constant/imgPath';

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

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

const calculateBearing = (start, end) => {
  if (!start || !end) return 0;

  const lat1 = (start.latitude * Math.PI) / 180;
  const lat2 = (end.latitude * Math.PI) / 180;
  const lng1 = (start.longitude * Math.PI) / 180;
  const lng2 = (end.longitude * Math.PI) / 180;

  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
};

// Function to fetch shortest path from Google Maps API
const fetchShortestPath = async (
  origin,
  destination,
  mode = TRAVEL_MODES.DRIVING,
) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=${mode}&alternatives=true&key=${GOOGLE_MAPS_APIKEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      // Sort routes by distance to find the shortest
      const routesWithDistance = data.routes.map(route => {
        const distance = route.legs.reduce(
          (sum, leg) => sum + leg.distance.value,
          0,
        );
        const duration = route.legs.reduce(
          (sum, leg) => sum + leg.duration.value,
          0,
        );
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
const decodePolyline = encoded => {
  const points = [];
  let index = 0,
    lat = 0,
    lng = 0;

  while (index < encoded.length) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }
  return points;
};

// Normalize coordinates from [lng, lat] to {latitude, longitude}
const normalizeCoordinates = coords => {
  if (!coords) return null;
  if (Array.isArray(coords)) {
    return { latitude: coords[1], longitude: coords[0] };
  }
  if (coords.latitude && coords.longitude) {
    return coords;
  }
  return null;
};

const MapScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const profile = useSelector(selectProfile);
  const hasPermission = useSelector(
    state => state.permission?.locationGranted ?? false,
  );
  const vehicleType = profile?.vehicleDetails?.type || 'scooter';
  // Add this with your other refs
  const cameraUpdateTimeout = useRef(null);
  const lastCameraUpdate = useRef(null);

  const driverMarkerImage = useMemo(() => {
    const vType = vehicleType.toLowerCase();
    if (vType.includes('bike') || vType.includes('motorcycle')) return require('../../assets/bike.png');
    if (vType.includes('scooter')) return require('../../assets/scooter.png');
    if (vType.includes('auto') || vType.includes('rickshaw') || vType.includes('riksha')) return require('../../assets/auto.png');
    if (vType.includes('truck') && vType.includes('mini')) return require('../../assets/truck.png');
    if (vType.includes('truck')) return require('../../assets/truck.png');
    return require('../../assets/topscooter.png');
  }, [vehicleType]);

  // Parse and normalize the incoming order data
  const rawOrder = useMemo(
    () => route?.params?.order || null,
    [route?.params?.order],
  );

  const { order } = route?.params;

  const [initialOrder] = useState(() => route?.params?.order || null);

  // console.log('check order data for id:', order);

  // Transform the pending request format to the format expected by the component
  const normalizedOrder = useMemo(() => {
    if (!rawOrder) {
      return createMockNearbyOrder();
    }

    // Handle the pending request format from your API
    if (rawOrder.rideId || rawOrder.rideDetails) {
      return {
        id: rawOrder.rideId || `ORD${Date.now()}`,
        status: 'pending',
        pickupLocation: {
          coordinates: normalizeCoordinates(
            rawOrder.pickupLocation?.coordinates,
          ),
          address: rawOrder.pickupLocation?.address || 'Pickup location',
        },
        dropLocation: {
          coordinates: normalizeCoordinates(rawOrder.dropLocation?.coordinates),
          address: rawOrder.dropLocation?.address || 'Drop location',
        },
        customer: {
          name: rawOrder.customerDetails?.name || 'Customer',
          phone: rawOrder.customerDetails?.phone,
          rating: rawOrder.customerDetails?.rating || 0,
        },
        rideDetails: rawOrder.rideDetails,
        amount: rawOrder.rideDetails?.estimatedFare || 0,
        totalAmount: rawOrder.rideDetails?.estimatedFare || 0,
        paymentMode: 'cash', // Default to cash, can be updated from API
        requestedAt: rawOrder.requestedAt,
        distance: rawOrder.rideDetails?.distance || 0,
        duration: rawOrder.rideDetails?.duration || 0,
      };
    }

    // Handle the existing order format
    return rawOrder;
  }, [rawOrder]);

  const order_data = rawOrder;

  // console.log('ram ram ram', order);

  const pickup = useMemo(() => {
    const coords = order?.pickupLocation?.coordinates;
    return coords
      ? normalizeCoordinates(coords)
      : { latitude: 22.7261, longitude: 75.8931 };
  }, [order]);

  const drop = useMemo(() => {
    const coords = order?.dropLocation?.coordinates;
    return coords
      ? normalizeCoordinates(coords)
      : { latitude: 22.7203, longitude: 75.9059 };
  }, [order]);

  const pickupAddress = useMemo(
    () =>
      order?.pickupLocation?.address ||
      order?.pickupAddress ||
      'Pickup address unavailable',
    [order],
  );

  const dropAddress = useMemo(
    () =>
      order?.dropLocation?.address ||
      order?.dropAddress ||
      'Drop address unavailable',
    [order],
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
  const [distance, setDistance] = useState(
    order?.rideDetails?.distance || null,
  );
  const [duration, setDuration] = useState(
    order?.rideDetails?.duration || null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [usingApproximateRoute, setUsingApproximateRoute] = useState(false);
  const [showDropRoute, setShowDropRoute] = useState(false);
  const [isAtPickup, setIsAtPickup] = useState(false);
  const [isAtDrop, setIsAtDrop] = useState(false);
  const [is3DMode, setIs3DMode] = useState(false);
  const [arrowRotation, setArrowRotation] = useState(0);
  const [nextWaypoint, setNextWaypoint] = useState(null);

  // Ripple animation for location marker
  const rippleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rippleAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ).start();
  }, [rippleAnim]);

  // const rippleScale = rippleAnim.interpolate({
  //   inputRange: [0, 1],
  //   outputRange: [1, 2.5],
  // });

  // const rippleOpacity = rippleAnim.interpolate({
  //   inputRange: [0, 1],
  //   outputRange: [0.6, 0],
  // });

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
  const [isMapReady, setIsMapReady] = useState(false);

  // Memoized destination
  const destination = useMemo(() => {
    if (
      tripStage === STAGES.GOING_TO_PICKUP ||
      tripStage === STAGES.ARRIVED_PICKUP
    ) {
      return pickup;
    }
    if (
      tripStage === STAGES.GOING_TO_DROP ||
      tripStage === STAGES.ARRIVED_DROP
    ) {
      return drop;
    }
    return null;
  }, [drop, pickup, tripStage]);

  // Initialize from order status
  useEffect(() => {
    try {
      const status = String(order?.status || '').toLowerCase();
      if (
        status === 'picked_up' ||
        status === 'pickedup' ||
        status === 'accepted'
      ) {
        setTripStage(STAGES.GOING_TO_PICKUP);
        setShowDropRoute(true);
      } else {
        setTripStage(STAGES.GOING_TO_DROP);
        setShowDropRoute(false);
      }
    } catch (error) {
      console.error('Error setting initial stage:', error);
    }
  }, [order?.status]);

  // Initialize socket tracking for the active ride
  useEffect(() => {
    if (order && (order.id || order.rideId)) {
      const rideId = order.rideId || order.id;
      console.log('🚗 MapScreen: Setting up socket tracking for ride:', rideId);
      SocketService.setActiveRide(rideId);
    }
  }, [order?.id, order?.rideId]);

  // Track pickup/drop proximity for action availability
  useEffect(() => {
    if (!driverCoords || !pickup || !drop) return;

    const pickupDistance = calculateHaversineDistance(driverCoords, pickup);
    const dropDistance = calculateHaversineDistance(driverCoords, drop);

    const reachedPickup = pickupDistance <= 60;
    const reachedDrop = dropDistance <= 50;

    setIsAtPickup(reachedPickup);
    setIsAtDrop(reachedDrop);

    if (reachedPickup && tripStage === STAGES.GOING_TO_PICKUP) {
      setTripStage(STAGES.ARRIVED_PICKUP);
      setShowDropRoute(true);
    }

    if (reachedDrop && tripStage === STAGES.GOING_TO_DROP) {
      setTripStage(STAGES.ARRIVED_DROP);
    }
  }, [driverCoords, pickup, drop, tripStage]);

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
      const result = await fetchShortestPath(
        driverCoords,
        destination,
        travelMode,
      );

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
      if (
        selectedRoute &&
        selectedRoute.coordinates &&
        selectedRoute.coordinates.length > 1
      ) {
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
        const nextIndex = Math.min(
          closestIndex + 1,
          selectedRoute.coordinates.length - 1,
        );
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

  // update camera view (2D/3D based on mode)
  const updateCamera = useCallback(
    (coords, heading = 0, animated = true) => {
      if (!mapRef.current || !coords) return;

      // Clear previous timeout
      if (cameraUpdateTimeout.current) {
        clearTimeout(cameraUpdateTimeout.current);
      }

      // Debounce camera updates to prevent rapid successive calls
      cameraUpdateTimeout.current = setTimeout(() => {
        try {
          // Check if coordinates changed significantly before updating
          if (lastCameraUpdate.current) {
            const distance = calculateHaversineDistance(
              lastCameraUpdate.current,
              coords,
            );
            // Only update if moved more than 10 meters
            if (distance < 10 && !animated) {
              return;
            }
          }

          const camera = {
            center: coords,
            pitch: is3DMode ? 60 : 0,
            heading: heading || 0,
            altitude: is3DMode ? 1200 : 600,
            zoom: is3DMode ? 17 : 18,
          };

          if (animated) {
            mapRef.current.animateCamera(camera, { duration: 500 });
          } else {
            mapRef.current.setCamera(camera);
          }

          lastCameraUpdate.current = coords;
        } catch (error) {
          console.error('Error updating camera:', error);
        }
      }, 100); // 100ms debounce
    },
    [is3DMode],
  );

  // Update the useEffect that follows the driver
  useEffect(() => {
    if (
      isMapReady &&
      driverCoords &&
      (tripStage === STAGES.GOING_TO_PICKUP ||
        tripStage === STAGES.GOING_TO_DROP ||
        tripStage === STAGES.ARRIVED_DROP) &&
      // Only update if driver has moved significantly
      lastCameraUpdate.current &&
      calculateHaversineDistance(lastCameraUpdate.current, driverCoords) > 15
    ) {
      updateCamera(driverCoords, arrowRotation);
    } else if (driverCoords && !lastCameraUpdate.current) {
      // Initial update
      updateCamera(driverCoords, arrowRotation);
    }
  }, [driverCoords, tripStage, arrowRotation, updateCamera]);

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
            console.log("ckeck ram ram", coords);
            
            setDriverCoords(coords);
            lastKnownCoords.current = coords;
            setIsLoading(false);

            // Only update camera after initial location is set
            setTimeout(() => {
              if (mapRef.current) {
                updateCamera(coords, 0, false);
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

            // Don't update camera here, let the useEffect handle it with debouncing
          } catch (error) {
            console.error('Error processing watch position:', error);
          }
        },
        error => console.log('Watch error:', error),
        {
          enableHighAccuracy: true,
          distanceFilter: 10, // Only update when moved 10 meters
          interval: 3000, // Reduce frequency to 3 seconds
          fastestInterval: 2000, // Fastest interval 2 seconds
        },
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setIsLoading(false);
      setLocationError('Could not start location tracking');
    }
  }, [pickup.latitude, pickup.longitude, updateCamera]);

  useEffect(() => {
    const resolvePermission = async () => {
      if (!hasPermission) {
        const granted = await getLocationPermission();
        dispatch(setLocationPermission(granted));
      }
    };

    resolvePermission();
  }, [hasPermission, dispatch]);

  useEffect(() => {
    if (hasPermission) {
      startLocationTracking();
      
      // Update foreground service to 'on_trip' mode when trip starts
      try {
        updateService('on_trip', {
          orderId: order?.id || order?.rideId,
          pickup: pickupAddress,
          drop: dropAddress,
        });
        console.log('🚗 Foreground service updated to on_trip mode');
      } catch (error) {
        console.error('Error updating service to on_trip:', error);
      }
    }
  }, [hasPermission]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (hasPermission) {
          startLocationTracking();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      stopLocationTracking();
      // Clean up camera timeout
      if (cameraUpdateTimeout.current) {
        clearTimeout(cameraUpdateTimeout.current);
      }
    };
  }, [hasPermission, startLocationTracking, stopLocationTracking]);

  // Fixed distance calculation using Haversine formula
  useEffect(() => {
    if (!driverCoords || !destination) return;

    try {
      const distanceInMeters = calculateHaversineDistance(
        driverCoords,
        destination,
      );

      if (!isNaN(distanceInMeters) && distanceInMeters >= 0) {
        // Only update distance if we don't have a route-based distance
        if (!selectedRoute) {
          setDistance(distanceInMeters / 1000);
        }

        // Arrived at pickup
        if (distanceInMeters <= 60 && tripStage === STAGES.GOING_TO_PICKUP) {
          setTripStage(STAGES.ARRIVED_PICKUP);

          if (mapRef.current) {
            updateCamera(pickup, 0);
          }

          Alert.alert(
            '📍 Arrived',
            'You have reached pickup location. Confirm pickup now.',
          );
        }

        // Arrived at drop
        if (distanceInMeters <= 50 && tripStage === STAGES.GOING_TO_DROP) {
          setTripStage(STAGES.ARRIVED_DROP);

          if (mapRef.current) {
            updateCamera(drop, 0);
          }

          Alert.alert(
            '🎯 Arrived',
            'You have reached the destination. Complete delivery when ready.',
          );
        }
      }
    } catch (error) {
      console.error('Error calculating distance:', error);
      setDistance(null);
    }
  }, [
    destination,
    driverCoords,
    tripStage,
    pickup,
    drop,
    updateCamera,
    selectedRoute,
  ]);

  // Emit location to socket every 3 seconds for real-time tracking
  useEffect(() => {
    if (!driverCoords || !tripStage || tripStage === STAGES.COMPLETED) return;

    console.log('⏲️ Starting 3-second location update interval for socket');

    const locationUpdateInterval = setInterval(() => {
      try {
        SocketService.emitLocation(
          driverCoords.latitude,
          driverCoords.longitude,
          arrowRotation || 0,
          0 // Speed - would need to calculate from position deltas if needed
        );
        console.log(
          '✅ Location update check: 3 sec interval',
          {
            lat: driverCoords.latitude.toFixed(4),
            lng: driverCoords.longitude.toFixed(4),
            stage: tripStage,
            timestamp: new Date().toLocaleTimeString(),
          }
        );
      } catch (error) {
        console.error('Error emitting location to socket:', error);
      }
    }, 3000); // Update every 3 seconds

    return () => {
      clearInterval(locationUpdateInterval);
      console.log('⏲️ Cleared location update interval');
    };
  }, [driverCoords, arrowRotation, tripStage]);

  const handleSelectRoute = route => {
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
    const phone = order?.customer?.phone || order?.customerPhone;
    if (!phone) {
      Alert.alert(
        'No phone number',
        'Customer phone number is not available for this order.',
      );
      return;
    }
    const url = `tel:${phone}`;
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert(
            'Cannot make call',
            `Unable to call customer. Please dial ${phone} manually.`,
          );
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

    const cancelId = order?.rideId || order?.id || initialOrder?.rideId || initialOrder?.id;

    console.log("cancel data check id", cancelId);


    setIsCancelling(true);
    try {
      await driverApi.cancelOrder(cancelId, cancelReason);
    } catch (error) {
      console.error('Cancel order failed but clearing local state:', error);
      // Proceed even if backend fails — clear local state
    }

    await setActiveOrder(null);
    await addNotification({
      title: 'Trip Cancelled',
      body: `Order ${cancelId} cancelled: ${cancelReason}`,
      type: 'order',
      data: order,
    });

    setIsCancelling(false);
    setShowCancelModal(false);
    setCancelReason('');
    stopLocationTracking();
    
    // Switch foreground notification back to online/waiting mode
    try {
      await updateService('online');
      console.log('🟡 Foreground service restored to online mode after trip cancellation');
    } catch (error) {
      console.error('Error updating service after cancellation:', error);
    }
    
    navigation.navigate('MyTabs');
  };

  const handlePickupOtpSubmit = async () => {
    const expectedCode = order?.pickupCode || order?.otp || order?.pickup_otp;
    // If no OTP is set by backend, allow any 4-digit code
    if (expectedCode && pickupOtp !== String(expectedCode)) {
      Alert.alert(
        'Invalid Code',
        'The pickup verification code is incorrect. Please check with the customer.',
      );
      return;
    }
    if (pickupOtp.length < 4) {
      Alert.alert(
        'Enter Code',
        'Please enter the 4-digit pickup verification code.',
      );
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

      // Update foreground notification to show 'Heading to Drop'
      await updateServiceBody(
        `Order #${String(order?.id || '')
          .slice(-6)
          .toUpperCase()} — Heading to Drop\n🏁 ${dropAddress}`,
      );

      if (mapRef.current && driverCoords) {
        updateCamera(driverCoords, arrowRotation);
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

      const amount =
        paymentMethod === 'cash'
          ? parseFloat(cashCollected)
          : order?.amount || 0;

      let serverCompleted = null;
      try {
        serverCompleted = await driverApi.completeOrder(
          order.id,
          distance || 0,
          {
            amount,
            paymentMethod,
          },
        );
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

      // Switch foreground notification back to online/waiting mode
      await updateService('online');

      Alert.alert(
        'Delivery Complete',
        `Order delivered successfully. ₹${amount} collected.\nYour earnings: ₹${(
          amount * 0.8
        ).toFixed(2)}`,
        [
          {
            text: 'Go Home',
            onPress: () => navigation.navigate('MyTabs'),
          },
        ],
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

  const mapCenter = driverCoords || pickup || { latitude: 22.7261, longitude: 75.8931 };

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />

        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: mapCenter.latitude,
            longitude: mapCenter.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onMapReady={() => setIsMapReady(true)}
          pitchEnabled={is3DMode}
          rotateEnabled={true}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={true}
          showsBuildings={is3DMode}
          loadingEnabled={true}
          moveOnMarkerPress={false}
          enableHighAccuracy={true}
          // Add these to prevent unnecessary updates
          toolbarEnabled={false}
          zoomControlEnabled={false}
          // Use liteMode for better performance (optional)
          liteMode={false}
        >
          {/* Direction Arrow Marker with Auto-rotation */}
          {/* Direction Arrow Marker with Proper Rotation */}
          {driverCoords && (
            <Marker
              coordinate={driverCoords}
              anchor={{ x: 0.5, y: 0.5 }}
              flat={true}
              rotation={arrowRotation}
              tracksViewChanges={true} // Change to true to track view changes for rotation
            >
              <Image
                source={imgPath.ic_bike}
                style={{
                  width: 50,
                  height: 50,
                  transform: [{ rotate: `${arrowRotation}deg` }]
                }}
                resizeMode="contain"
              />
            </Marker>
          )}

          {/* Pickup Marker */}
          {pickup && (
            <Marker coordinate={pickup} anchor={{ x: 0.5, y: 1.0 }} tracksViewChanges={false} >
              <Image
                source={imgPath.ic_pick}
                style={{ width: 50, height: 50 }} // ✅ ab kaam karega
                resizeMode="contain"
              />
            </Marker>
          )}

          {/* Drop Marker */}
          {showDropRoute && drop && (
            <Marker coordinate={drop} anchor={{ x: 0.5, y: 1.0 }} tracksViewChanges={false} >
              <Image
                source={imgPath.ic_drop}
                style={{ width: 50, height: 50 }} // ✅ ab kaam karega
                resizeMode="contain"
              />
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

          <MapViewDirections
            origin={pickup}
            destination={drop}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={6}
            strokeColor={theme.colors.primary}
            optimizeWaypoints={true}
            lineDashPattern={[0]}
            lineCap="round"
            lineJoin="round"
            onReady={result => {
              mapRef.current.fitToCoordinates(result.coordinates, {
                edgePadding: {
                  top: 50,
                  bottom: 50,
                  left: 50,
                  right: 50,
                },
              });
            }}
          />

          {/* Selected Route Polyline */}
          {/* {selectedRoute && selectedRoute.coordinates && (
            <Polyline
              coordinates={selectedRoute.coordinates}
              strokeWidth={6}
              strokeColor={
                showDropRoute ? theme.colors.path : theme.colors.primary
              }
              lineDashPattern={[0]}
              lineCap="round"
              lineJoin="round"
            />
          )} */}

          {/* Alternative Routes (dashed lines) */}
          {/* {alternativeRoutes.map((route, index) => (
            <Polyline
              key={`alt-route-${index}`}
              coordinates={route.coordinates}
              strokeWidth={3}
              strokeColor="rgba(100, 100, 100, 0.5)"
              lineDashPattern={[10, 5]}
              lineCap="round"
              lineJoin="round"
            />
          ))} */}
        </MapView>

        {/* Route Info and Selection Button */}
        {/* {selectedRoute && (
          <TouchableOpacity
            style={styles.routeInfoButton}
            onPress={() => setShowRouteOptions(!showRouteOptions)}
          >
            <View style={styles.routeInfoContent}>
              <Text style={styles.routeInfoTitle}>
                {showDropRoute
                  ? '📍 Shortest Route to Drop'
                  : '📍 Shortest Route to Pickup'}
              </Text>
              <Text style={styles.routeInfoDetails}>
                {selectedRoute.distance / 1000 < 1
                  ? `${Math.round(selectedRoute.distance)} m`
                  : `${(selectedRoute.distance / 1000).toFixed(1)} km`}{' '}
                •{Math.round(selectedRoute.duration / 60)} min •
                {selectedRoute.summary || 'via fastest route'}
              </Text>
            </View>
            <Text style={styles.routeInfoArrow}>▼</Text>
          </TouchableOpacity>
        )} */}

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
                <Text style={styles.modalTitle}>Select Route</Text>
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
                      <Text
                        style={[
                          styles.travelModeButtonText,
                          travelMode === mode &&
                          styles.travelModeButtonTextActive,
                        ]}
                      >
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
                    <ActivityIndicator
                      size="large"
                      color={theme.colors.primary}
                    />
                    <Text style={styles.loadingRoutesText}>
                      Finding best routes...
                    </Text>
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
                          {index === 0
                            ? ' Shortest Route'
                            : ` Alternative ${index}`}
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
                          {(route.distance / 1000).toFixed(1)} km
                        </Text>
                        <Text style={styles.routeOptionDuration}>
                          {Math.round(route.duration / 60)} min
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {usingApproximateRoute && !selectedRoute && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Using approximate route. Tap route info to find shortest path.
            </Text>
          </View>
        )}

        {/* Bottom Card */}
        {/* Premium Header Overlay */}
        <View style={styles.mapHeaderOverlay}>
          <TouchableOpacity
            style={styles.backBtnRound}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.ink} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.map3DButton,
              is3DMode && styles.map3DButtonActive,
            ]}
            onPress={() => {
              setIs3DMode(prev => !prev);
              if (driverCoords) {
                updateCamera(driverCoords, arrowRotation);
              }
            }}
          >
            <Text style={styles.map3DButtonText}>
              {is3DMode ? '2D View' : '3D View'}
            </Text>
          </TouchableOpacity>

          {/* <View style={styles.headerTitleCard}>
            <Text style={styles.headerTripId}>
              Order #
              {String(order?.id || '')
                .slice(-6)
                .toUpperCase()}
            </Text>
            <Text style={styles.headerStageText}>
              {tripStage === STAGES.GOING_TO_PICKUP
                ? 'Heading to Pickup'
                : tripStage === STAGES.ARRIVED_PICKUP
                ? 'At Pickup'
                : tripStage === STAGES.GOING_TO_DROP
                ? 'Heading to Drop'
                : 'At Destination'}
            </Text>
          </View> */}

          {/* <TouchableOpacity
            style={styles.helpBtnRound}
            onPress={() => Alert.alert('Help', 'Contacting support...')}
          >
            <Ionicons name="help-buoy" size={24} color={theme.colors.danger} />
          </TouchableOpacity> */}
        </View>

        {/* Navigation Card */}
        <View style={styles.navCardOverlay}>
          <View style={styles.navInfoRow}>
            <View style={styles.navInfoItem}>
              <Text style={styles.navInfoLabel}>DISTANCE</Text>
              <Text style={styles.navInfoValue}>
                {distance ? `${distance.toFixed(1)} km` : '--'}
              </Text>
            </View>
            <View style={styles.navInfoDivider} />
            <View style={styles.navInfoItem}>
              <Text style={styles.navInfoLabel}>TIME</Text>
              <Text style={styles.navInfoValue}>
                {duration ? `${duration} min` : '--'}
              </Text>
            </View>
            <>
              <View style={styles.navInfoDivider} />
              <View style={styles.navInfoItem}>
                <Text style={styles.navInfoLabel}>Amount</Text>
                <Text
                  style={[styles.navInfoValue, { color: theme.colors.success }]}
                >
                  ₹{Number(order?.estimatedFare)}
                </Text>
              </View>
            </>
          </View>

          <View style={styles.addressCard}>
            <View style={styles.addressIndicatorCol}>
              <View
                style={[
                  styles.addressDot,
                  {
                    backgroundColor: tripStage.includes('PICKUP')
                      ? theme.colors.success
                      : theme.colors.danger,
                  },
                ]}
              />
              <View style={styles.addressLine} />
            </View>
            <View style={styles.addressTextCol}>
              <Text style={styles.addressLabel}>
                {tripStage.includes('PICKUP') ? 'PICKUP FROM' : 'DROP AT'}
              </Text>
              <Text style={styles.addressText} numberOfLines={2}>
                {tripStage.includes('PICKUP') ? pickupAddress : dropAddress}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.phoneCircle}
              onPress={handleCallCustomer}
            >
              <Ionicons name="call" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.actionRowPrimary}>
            {tripStage === STAGES.GOING_TO_PICKUP && (
              isAtPickup ? (
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => setTripStage(STAGES.ARRIVED_PICKUP)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryActionText}>ARRIVED AT PICKUP</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.disabledActionMsg}>
                  <Text style={styles.disabledActionText}>
                    Reach pickup location to mark arrived
                  </Text>
                </View>
              )
            )}
            {tripStage === STAGES.ARRIVED_PICKUP && (
              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  { backgroundColor: theme.colors.success },
                ]}
                onPress={handlePickupConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionText}>START TRIP</Text>
              </TouchableOpacity>
            )}
            {tripStage === STAGES.GOING_TO_DROP && isAtDrop && (
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => setTripStage(STAGES.ARRIVED_DROP)}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionText}>ARRIVED AT DROP</Text>
              </TouchableOpacity>
            )}
            {tripStage === STAGES.GOING_TO_DROP && !isAtDrop && (
              <View style={styles.disabledActionMsg}>
                <Text style={styles.disabledActionText}>
                  Reach drop location to mark arrived
                </Text>
              </View>
            )}
            {tripStage === STAGES.ARRIVED_DROP && (
              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  { backgroundColor: theme.colors.success },
                ]}
                onPress={() => setShowCashModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryActionText}>COMPLETE ORDER</Text>
              </TouchableOpacity>
            )}
          </View>
          <View>
            {tripStage !== STAGES.COMPLETED && (
              <TouchableOpacity
                style={styles.cancelTripButton}
                onPress={() => setShowCancelModal(true)}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#ff0303', fontSize: 13 }} >Cancel trip</Text>
              </TouchableOpacity>
            )}
          </View>
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
                <TouchableOpacity
                  onPress={() => !isCancelling && setShowCancelModal(false)}
                >
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cancelSubtext}>
                Select a reason for cancellation:
              </Text>
              {[
                'Vehicle breakdown',
                'Customer not reachable',
                'Wrong address',
                'Personal emergency',
                'Other',
              ].map(reason => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.cancelReasonItem,
                    cancelReason === reason && styles.cancelReasonActive,
                  ]}
                  onPress={() => setCancelReason(reason)}
                  disabled={isCancelling}
                >
                  <Ionicons
                    name={
                      cancelReason === reason
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={20}
                    color={
                      cancelReason === reason ? theme.colors.danger : '#999'
                    }
                  />
                  <Text
                    style={[
                      styles.cancelReasonText,
                      cancelReason === reason && styles.cancelReasonTextActive,
                    ]}
                  >
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.dangerButton,
                  isCancelling && styles.disabledButton,
                ]}
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
              <Text style={styles.cancelSubtext}>
                Enter the 4-digit code provided by the customer to verify
                pickup:
              </Text>
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
                <Text style={styles.primaryButtonText}>
                  ✅ Verify & Confirm Pickup
                </Text>
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
                  Distance:{' '}
                  {distance
                    ? distance < 1
                      ? `${Math.round(distance * 1000)} m`
                      : `${distance.toFixed(1)} km`
                    : '0 km'}
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
                    <Text
                      style={[
                        styles.paymentMethodText,
                        paymentMethod === method &&
                        styles.paymentMethodTextActive,
                      ]}
                    >
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
                    style={[
                      styles.amountInput,
                      modalError && styles.inputError,
                    ]}
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
                  <Text style={styles.amountDisplayLabel}>
                    Amount to collect:
                  </Text>
                  <Text style={styles.amountDisplayValue}>
                    ₹{order?.amount || 0}
                  </Text>
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
                    {paymentMethod === 'cash'
                      ? '✅ Cash Collected'
                      : '✅ Confirm Payment'}
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
  markerImage: {
    width: 30,
    height: 30,
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
    top: 10,
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
    top: '20%',
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
  disabledActionMsg: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginBottom: 8,
  },
  disabledActionText: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
  },
  map3DButton: {
    position: 'absolute',
    right: 60,
    top: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  map3DButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  map3DButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },

  // Premium Navigation UI Styles
  mapHeaderOverlay: {
    position: 'absolute',
    top: moderateScale(10),
    left: moderateScale(16),
    right: moderateScale(16),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  backBtnRound: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  helpBtnRound: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.danger,
    ...theme.shadow.card,
  },
  headerTitleCard: {
    flex: 1,
    marginHorizontal: moderateScale(12),
    backgroundColor: '#fff',
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(16),
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  headerTripId: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    color: theme.colors.muted,
  },
  headerStageText: {
    fontSize: moderateScale(15),
    fontWeight: '900',
    color: theme.colors.ink,
    marginTop: 2,
  },

  navCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    padding: moderateScale(20),
    paddingBottom:
      Platform.OS === 'ios' ? moderateScale(40) : moderateScale(25),
    ...theme.shadow.card,
    elevation: 20,
  },
  navInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: moderateScale(18),
  },
  navInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  navInfoLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: theme.colors.muted,
    marginBottom: 4,
  },
  navInfoValue: {
    fontSize: moderateScale(16),
    fontWeight: '900',
    color: theme.colors.ink,
  },
  navInfoDivider: {
    width: 1,
    height: 20,
    backgroundColor: theme.colors.border,
  },

  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.lg,
    padding: moderateScale(12),
    marginBottom: moderateScale(20),
  },
  addressIndicatorCol: {
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  addressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  addressLine: {
    width: 2,
    height: 20,
    backgroundColor: theme.colors.border,
    marginTop: 4,
  },
  addressTextCol: {
    flex: 1,
  },
  addressLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: theme.colors.muted,
  },
  addressText: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: theme.colors.ink,
    marginTop: 2,
  },
  phoneCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  actionRowPrimary: {
    width: '100%',
  },
  primaryActionBtn: {
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    paddingVertical: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: moderateScale(16),
    letterSpacing: 1.2,
  },
  cancelTripButton: {
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
    backgroundColor: 'rgba(212, 246, 59, 0.8)',
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
