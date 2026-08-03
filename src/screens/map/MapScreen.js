/**
 * GoDeLivo Captain App — MapScreen
 * 3D Navigation Upgrade (All Phases)
 *
 * Phase 1 — 3D Camera, Follow Mode, Smooth Rotation, Re-center Button
 * Phase 2 — Route Progress (Completed / Remaining Polylines)
 * Phase 3 — Off-route Detection + Automatic Re-routing
 * Phase 4 — Maneuver Data + Navigation Instruction UI
 * Phase 5 — Voice Navigation (Graceful TTS — no crash if package absent)
 *
 * All existing ride lifecycle, socket events, driverApi calls,
 * and bottom navigation panel are fully preserved.
 */

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
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Polyline,
  AnimatedRegion,
} from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { moderateScale } from 'react-native-size-matters';
import LocationService from '../../services/locationService';
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
import toast from '../../utils/toast';

// ─── Phase 5: Graceful TTS Import ────────────────────────────────────────────
// Silently skipped if react-native-tts is not installed/linked.
let Tts = null;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  Tts = require('react-native-tts').default || require('react-native-tts');
  if (Tts && typeof Tts.setDefaultLanguage === 'function') {
    Tts.setDefaultLanguage('en-IN');
    Tts.setDefaultRate(0.48);
    Tts.setDefaultPitch(1.0);
  }
} catch (_) {
  Tts = null;
}

const { width, height } = Dimensions.get('window');

// ─── Navigation Constants ─────────────────────────────────────────────────────
const NAV_PITCH           = 50;      // 3D tilt angle during navigation (degrees)
const NAV_ZOOM            = 18;      // navigation zoom level
const ARRIVED_PITCH       = 0;       // overhead when arrived
const ARRIVED_ZOOM        = 17;      // zoom when arrived

const OFF_ROUTE_THRESHOLD_M  = 50;   // meters off-route to start counting
const OFF_ROUTE_CONFIRM_COUNT = 3;   // consecutive readings before reroute
const REROUTE_COOLDOWN_MS    = 30000; // 30 s between reroutes
const CAMERA_THROTTLE_MS     = 800;  // min ms between camera animations
const LOOK_AHEAD_POINTS      = 5;    // route points ahead for bearing look-ahead
const HEADING_SMOOTH          = 0.3; // lower = smoother but slower heading

// ─── Ride Stages ──────────────────────────────────────────────────────────────
const STAGES = {
  GOING_TO_PICKUP: 'GOING_TO_PICKUP',
  ARRIVED_PICKUP:  'ARRIVED_PICKUP',
  GOING_TO_DROP:   'GOING_TO_DROP',
  ARRIVED_DROP:    'ARRIVED_DROP',
  COMPLETED:       'COMPLETED',
};

const TRAVEL_MODES = {
  DRIVING:   'driving',
  WALKING:   'walking',
  BICYCLING: 'bicycling',
  TRANSIT:   'transit',
};

// ─── Error Boundary ───────────────────────────────────────────────────────────
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

// ─── Pure Utility Functions ───────────────────────────────────────────────────

/** Haversine distance in metres between two {latitude, longitude} points. */
const calculateHaversineDistance = (start, end) => {
  if (!start || !end) return 0;
  const R = 6371e3;
  const φ1 = (start.latitude  * Math.PI) / 180;
  const φ2 = (end.latitude    * Math.PI) / 180;
  const Δφ = ((end.latitude  - start.latitude)  * Math.PI) / 180;
  const Δλ = ((end.longitude - start.longitude) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Compass bearing (0–360) from start to end. */
const calculateBearing = (start, end) => {
  if (!start || !end) return 0;
  const lat1 = (start.latitude  * Math.PI) / 180;
  const lat2 = (end.latitude    * Math.PI) / 180;
  const lng1 = (start.longitude * Math.PI) / 180;
  const lng2 = (end.longitude   * Math.PI) / 180;
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

/**
 * Shortest-angle heading interpolation.
 * Prevents 359° → 0° backward rotation (spinning ~360°).
 */
const smoothAngle = (from, to, factor = HEADING_SMOOTH) => {
  const diff = ((to - from + 540) % 360) - 180;
  return (from + diff * factor + 360) % 360;
};

/**
 * Find the nearest route-point index to driver coords.
 * Starts from hintIndex to avoid a full backward scan every update.
 */
const findNearestRouteIndex = (coords, routeCoords, hintIndex = 0) => {
  if (!coords || !routeCoords || routeCoords.length === 0) {
    return { index: 0, distance: Infinity };
  }
  let nearestIndex = hintIndex;
  let nearestDist  = Infinity;

  const start = Math.max(0, hintIndex - 5);
  const end   = Math.min(routeCoords.length - 1, hintIndex + 50);

  for (let i = start; i <= end; i++) {
    const d = calculateHaversineDistance(coords, routeCoords[i]);
    if (d < nearestDist) { nearestDist = d; nearestIndex = i; }
  }
  // If we hit the forward scan window edge, do a full forward pass.
  if (nearestIndex >= end && end < routeCoords.length - 1) {
    for (let i = end + 1; i < routeCoords.length; i++) {
      const d = calculateHaversineDistance(coords, routeCoords[i]);
      if (d < nearestDist) { nearestDist = d; nearestIndex = i; } else break; // route is monotone
    }
  }
  return { index: nearestIndex, distance: nearestDist };
};

/** Strip HTML tags from Google Directions step instructions. */
const stripHtml = html => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

/** Map a Google Directions maneuver string to a Unicode arrow icon. */
const getManeuverIcon = maneuver => {
  const MAP = {
    'turn-left':        '↰',
    'turn-right':       '↱',
    'turn-slight-left': '↖',
    'turn-slight-right':'↗',
    'turn-sharp-left':  '↺',
    'turn-sharp-right': '↻',
    'uturn-left':       '↩',
    'uturn-right':      '↪',
    'straight':         '↑',
    'keep-left':        '↖',
    'keep-right':       '↗',
    'merge':            '⇑',
    'ramp-left':        '↖',
    'ramp-right':       '↗',
    'fork-left':        '↖',
    'fork-right':       '↗',
    'roundabout-left':  '↺',
    'roundabout-right': '↻',
    'ferry':            '⛴',
    'arrive':           '📍',
  };
  return MAP[maneuver] || '↑';
};

/** Parse maneuver steps from sorted route array (shortest route first). */
const parseRouteSteps = routesWithDistance => {
  try {
    if (!routesWithDistance?.length) return [];
    const leg = routesWithDistance[0]?.legs?.[0];
    if (!leg?.steps) return [];
    return leg.steps.map((step, idx) => ({
      index:          idx,
      instruction:    stripHtml(step.html_instructions),
      maneuver:       step.maneuver || 'straight',
      icon:           getManeuverIcon(step.maneuver || 'straight'),
      distanceMeters: step.distance?.value  || 0,
      durationSec:    step.duration?.value  || 0,
      startLocation: {
        latitude:  step.start_location?.lat,
        longitude: step.start_location?.lng,
      },
      endLocation: {
        latitude:  step.end_location?.lat,
        longitude: step.end_location?.lng,
      },
    }));
  } catch { return []; }
};

// ─── Google Directions API (Enhanced with step parsing) ───────────────────────
const fetchShortestPath = async (origin, destination, mode = TRAVEL_MODES.DRIVING) => {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${origin.latitude},${origin.longitude}` +
      `&destination=${destination.latitude},${destination.longitude}` +
      `&mode=${mode}&alternatives=true&key=${GOOGLE_MAPS_APIKEY}`;

    const response = await fetch(url);
    const data     = await response.json();

    if (data.status !== 'OK' || !data.routes?.length) return null;

    const routesWithDistance = data.routes.map(route => ({
      ...route,
      distance:    route.legs.reduce((s, l) => s + l.distance.value, 0),
      duration:    route.legs.reduce((s, l) => s + l.duration.value, 0),
      coordinates: decodePolyline(route.overview_polyline.points),
      summary:     route.summary,
    }));

    routesWithDistance.sort((a, b) => a.distance - b.distance);

    return {
      routes:           routesWithDistance,
      shortestRoute:    routesWithDistance[0],
      alternativeRoutes:routesWithDistance.slice(1),
      steps:            parseRouteSteps(routesWithDistance),
    };
  } catch (error) {
    console.error('[MapScreen] fetchShortestPath error:', error);
    return null;
  }
};

// ─── Encoded Polyline Decoder ─────────────────────────────────────────────────
const decodePolyline = encoded => {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
};

// ─── Coordinate Normaliser ────────────────────────────────────────────────────
const normalizeCoordinates = coords => {
  if (!coords) return null;
  if (Array.isArray(coords)) return { latitude: coords[1], longitude: coords[0] };
  if (coords.latitude && coords.longitude) return coords;
  return null;
};

// ═════════════════════════════════════════════════════════════════════════════
//  MapScreen Component
// ═════════════════════════════════════════════════════════════════════════════
const MapScreen = ({ navigation, route }) => {
  const dispatch    = useDispatch();
  const profile     = useSelector(selectProfile);
  const hasPermission = useSelector(
    state => state.permission?.locationGranted ?? false,
  );
  const vehicleType = profile?.vehicleDetails?.type || 'scooter';

  // ── Vehicle Marker Image (memoised) — covers all vehicle type variants ───
  const driverMarkerImage = useMemo(() => {
    const v = (vehicleType || '').toLowerCase();
    // Bike / Motorcycle
    if (v.includes('motorcycle'))                                                        return require('../../assets/motorcycle.png');
    if (v.includes('bike'))                                                              return require('../../assets/bike.png');
    // Scooter
    if (v.includes('scooter'))                                                           return require('../../assets/scooter.png');
    // Auto / Riksha / 3-Wheeler
    if (v.includes('auto') || v.includes('rickshaw') || v.includes('riksha') ||
        v.includes('3 wheeler') || v.includes('3w'))                                    return require('../../assets/riksha.png');
    // Truck / Loader variants
    if (v.includes('mini') || v.includes('mini-truck') || v.includes('mini truck'))     return require('../../assets/mini-truck.png');
    if (v.includes('truck') || v.includes('tata') || v.includes('loader') ||
        v.includes('ace'))                                                               return require('../../assets/truck.png');
    // Motor / Electric
    if (v.includes('motor') || v.includes('electric'))                                  return require('../../assets/motor.png');
    // Default fallback
    return require('../../assets/topscooter.png');
  }, [vehicleType]);

  // ── Order / Location Data ──────────────────────────────────────────────────
  const rawOrder   = useMemo(() => route?.params?.order || null, [route?.params?.order]);
  // Safe destructure — route.params may be undefined when navigating without params
  const { order } = route?.params || {};
  const [initialOrder] = useState(() => route?.params?.order || null);

  const normalizedOrder = useMemo(() => {
    if (!rawOrder) return createMockNearbyOrder();
    if (rawOrder.rideId || rawOrder.rideDetails) {
      return {
        id: rawOrder.rideId || `ORD${Date.now()}`,
        status: 'pending',
        pickupLocation: {
          coordinates: normalizeCoordinates(rawOrder.pickupLocation?.coordinates),
          address:     rawOrder.pickupLocation?.address || 'Pickup location',
        },
        dropLocation: {
          coordinates: normalizeCoordinates(rawOrder.dropLocation?.coordinates),
          address:     rawOrder.dropLocation?.address || 'Drop location',
        },
        customer: {
          name:   rawOrder.customerDetails?.name   || 'Customer',
          phone:  rawOrder.customerDetails?.phone,
          rating: rawOrder.customerDetails?.rating || 0,
        },
        rideDetails:  rawOrder.rideDetails,
        amount:       rawOrder.rideDetails?.estimatedFare || 0,
        totalAmount:  rawOrder.rideDetails?.estimatedFare || 0,
        paymentMode:  'cash',
        requestedAt:  rawOrder.requestedAt,
        distance:     rawOrder.rideDetails?.distance || 0,
        duration:     rawOrder.rideDetails?.eta      || 0,
      };
    }
    return rawOrder;
  }, [rawOrder]);

  const pickup = useMemo(() => {
    const c = order?.pickupLocation?.coordinates;
    return c ? normalizeCoordinates(c) : { latitude: 22.7261, longitude: 75.8931 };
  }, [order]);

  const drop = useMemo(() => {
    const c = order?.dropLocation?.coordinates;
    return c ? normalizeCoordinates(c) : { latitude: 22.7203, longitude: 75.9059 };
  }, [order]);

  const pickupAddress = useMemo(
    () => order?.pickupLocation?.address || order?.pickupAddress || 'Pickup address unavailable',
    [order],
  );
  const dropAddress = useMemo(
    () => order?.dropLocation?.address || order?.dropAddress || 'Drop address unavailable',
    [order],
  );

  // ── Core Refs ──────────────────────────────────────────────────────────────
  const mapRef               = useRef(null);
  const unsubscribeLocation  = useRef(null);
  const appState             = useRef(AppState.currentState);
  const directionInterval    = useRef(null);
  const lastKnownCoords      = useRef(null);
  const lastRouteFetchedCoords = useRef(null);
  const lastDestination      = useRef(null);
  const isMounted            = useRef(true);   // guard setState after unmount

  // ── Navigation Refs (values that change frequently — avoid re-renders) ────
  const isFollowingDriver      = useRef(true);   // follow mode flag
  const lastStableHeading      = useRef(0);      // smoothed heading (degrees)
  const lastCameraUpdate       = useRef(null);   // last camera centre coord
  const lastCameraUpdateTime   = useRef(0);      // throttle: timestamp ms
  const cameraUpdateTimeout    = useRef(null);   // debounce timer
  const isFittingRoute         = useRef(false);  // true while fitToCoordinates is running
  const routeProgressIndex     = useRef(0);      // last nearest route index
  const routeCoordsRef         = useRef([]);     // full route coords (no re-render)
  const offRouteCount          = useRef(0);      // consecutive off-route readings
  const lastRerouteTime        = useRef(0);      // reroute cooldown
  const routeFetchInFlight     = useRef(false);  // prevent concurrent fetches
  const routeFetchVersion      = useRef(0);      // discard stale responses
  const currentManeuverIndex   = useRef(0);      // active maneuver step index
  const spokenManeuvers        = useRef(new Set()); // TTS dedup keys
  const routeStepsRef          = useRef([]);     // mirror of routeSteps state for stable closure
  const navCallbackRef         = useRef(null);   // stable location-event handler (updated via effect)

  // ── Animated Driver Marker ────────────────────────────────────────────────
  const animatedDriverCoords = useRef((() => {
    const last = LocationService.getLastCoords();
    if (last?.latitude != null) {
      return new AnimatedRegion({ latitude: last.latitude, longitude: last.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 });
    }
    const np = normalizeCoordinates(order?.pickupLocation?.coordinates);
    return new AnimatedRegion({ latitude: np?.latitude || 22.72592, longitude: np?.longitude || 75.89294, latitudeDelta: 0.005, longitudeDelta: 0.005 });
  })()).current;

  // ── UI State ──────────────────────────────────────────────────────────────
  const [tracksViewChanges,    setTracksViewChanges]    = useState(true);
  const [tripStage,            setTripStage]            = useState(STAGES.GOING_TO_PICKUP);
  const [driverCoords,         setDriverCoords]         = useState(() => LocationService.getLastCoords() || null);
  const [routeOrigin,          setRouteOrigin]          = useState(null);
  const [distance,             setDistance]             = useState(order?.rideDetails?.distance || null);
  const [duration,             setDuration]             = useState(order?.rideDetails?.eta      || null);
  const [isLoading,            setIsLoading]            = useState(true);
  const [locationError,        setLocationError]        = useState(null);
  const [usingApproximateRoute,setUsingApproximateRoute]= useState(false);
  const [showDropRoute,        setShowDropRoute]        = useState(false);
  const [isAtPickup,           setIsAtPickup]           = useState(false);
  const [isAtDrop,             setIsAtDrop]             = useState(false);
  const [arrowRotation,        setArrowRotation]        = useState(0);

  // ── Follow Mode State (controls Re-center button visibility) ──────────────
  const [isFollowingDriverState, setIsFollowingDriverState] = useState(true);

  // ── Route Progress State ──────────────────────────────────────────────────
  const [completedRouteCoords, setCompletedRouteCoords] = useState([]);
  const [remainingRouteCoords, setRemainingRouteCoords] = useState([]);

  // ── Route / Maneuver State ────────────────────────────────────────────────
  const [routes,           setRoutes]           = useState([]);
  const [selectedRoute,    setSelectedRoute]    = useState(null);
  const [alternativeRoutes,setAlternativeRoutes]= useState([]);
  const [showRouteOptions, setShowRouteOptions] = useState(false);
  const [travelMode,       setTravelMode]       = useState(TRAVEL_MODES.DRIVING);
  const [isFetchingRoutes, setIsFetchingRoutes] = useState(false);
  const [currentManeuver,  setCurrentManeuver]  = useState(null);
  const [routeSteps,       setRouteSteps]       = useState([]);
  const [isRerouting,      setIsRerouting]      = useState(false);

  // ── Modal States ──────────────────────────────────────────────────────────
  const [showCashModal,     setShowCashModal]     = useState(false);
  const [cashCollected,     setCashCollected]     = useState('');
  const [paymentMethod,     setPaymentMethod]     = useState('cash');
  const [isProcessing,      setIsProcessing]      = useState(false);
  const [modalError,        setModalError]        = useState('');
  const [showCancelModal,   setShowCancelModal]   = useState(false);
  const [cancelReason,      setCancelReason]      = useState('');
  const [isCancelling,      setIsCancelling]      = useState(false);
  const [showPickupOtpModal,setShowPickupOtpModal]= useState(false);
  const [pickupOtp,         setPickupOtp]         = useState('');
  const [isMapReady,        setIsMapReady]        = useState(false);

  // ── Ripple Animation ──────────────────────────────────────────────────────
  const rippleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rippleAnim, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ).start();
  }, [rippleAnim]);

  // ── Memoised Destination ──────────────────────────────────────────────────
  const destination = useMemo(() => {
    if (tripStage === STAGES.GOING_TO_PICKUP || tripStage === STAGES.ARRIVED_PICKUP) return pickup;
    if (tripStage === STAGES.GOING_TO_DROP   || tripStage === STAGES.ARRIVED_DROP)   return drop;
    return null;
  }, [drop, pickup, tripStage]);

  const isNavigating = tripStage === STAGES.GOING_TO_PICKUP || tripStage === STAGES.GOING_TO_DROP;

  // ── Keep routeStepsRef in sync ────────────────────────────────────────────
  useEffect(() => { routeStepsRef.current = routeSteps; }, [routeSteps]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Initialise stage from order status
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const status = String(order?.status || '').toLowerCase();
      if (status === 'picked_up' || status === 'pickedup') {
        setTripStage(STAGES.GOING_TO_DROP);
        setShowDropRoute(true);
      } else if (status === 'accepted' || status === 'pending') {
        setTripStage(STAGES.GOING_TO_PICKUP);
        setShowDropRoute(false);
      } else {
        setTripStage(STAGES.GOING_TO_DROP);
        setShowDropRoute(false);
      }
    } catch (err) { console.error('Error setting initial stage:', err); }
  }, [order?.status]);

  // ── Socket: join ride tracking ────────────────────────────────────────────
  useEffect(() => {
    if (order && (order.id || order.rideId)) {
      SocketService.setActiveRide(order.rideId || order.id);
    }
  }, [order?.id, order?.rideId]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Phase 5 — Voice Navigation
  // ─────────────────────────────────────────────────────────────────────────
  const speakInstruction = useCallback((text, key) => {
    if (!Tts || !text) return;
    if (spokenManeuvers.current.has(key)) return;
    spokenManeuvers.current.add(key);
    try { Tts.stop(); Tts.speak(text); } catch (_) {}
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  //  Phase 4 — Maneuver Updater (called per GPS update via navCallbackRef)
  // ─────────────────────────────────────────────────────────────────────────
  const updateCurrentManeuver = useCallback((coords, steps) => {
    if (!coords || !steps?.length) return;
    try {
      let idx = currentManeuverIndex.current;
      // Advance past completed steps
      while (idx < steps.length - 1) {
        const distToEnd = calculateHaversineDistance(coords, steps[idx].endLocation);
        if (distToEnd < 25) {
          idx++;
          currentManeuverIndex.current = idx;
          spokenManeuvers.current.clear();
        } else break;
      }

      const step = steps[idx];
      if (!step) return;
      const distToNext = calculateHaversineDistance(coords, step.startLocation);

      if (isMounted.current) {
        setCurrentManeuver({
          instruction:    step.instruction,
          maneuver:       step.maneuver,
          icon:           step.icon,
          distanceMeters: Math.round(distToNext),
        });

        // Voice triggers
        if (distToNext <= 320 && distToNext > 160) {
          const label = distToNext > 100 ? `${Math.round(distToNext / 50) * 50} meters` : `${Math.round(distToNext)} meters`;
          speakInstruction(`${step.instruction} in ${label}`, `${idx}-far`);
        } else if (distToNext <= 80 && distToNext > 15) {
          speakInstruction(step.instruction, `${idx}-now`);
        }
      }
    } catch (_) {}
  }, [speakInstruction]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Phase 2 — Route Progress Updater
  // ─────────────────────────────────────────────────────────────────────────
  const updateRouteProgress = useCallback(coords => {
    const full = routeCoordsRef.current;
    if (!full?.length || full.length < 2 || !coords) return undefined;

    const { index, distance: distToRoute } = findNearestRouteIndex(
      coords, full, routeProgressIndex.current,
    );

    if (Math.abs(index - routeProgressIndex.current) >= 1) {
      routeProgressIndex.current = index;
      if (isMounted.current) {
        setCompletedRouteCoords(full.slice(0, index + 1));
        setRemainingRouteCoords(full.slice(index));
      }
    }
    return distToRoute;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  //  Phase 3 — Off-route Detection
  // ─────────────────────────────────────────────────────────────────────────
  const triggerReroute = useCallback(async (coords, dest) => {
    if (!dest || !coords) return;
    if (routeFetchInFlight.current) return;
    const now = Date.now();
    if (now - lastRerouteTime.current < REROUTE_COOLDOWN_MS) return;

    routeFetchInFlight.current = true;
    const version = ++routeFetchVersion.current;
    if (isMounted.current) setIsRerouting(true);

    try {
      const result = await fetchShortestPath(coords, dest, TRAVEL_MODES.DRIVING);
      if (version !== routeFetchVersion.current || !result || !isMounted.current) return;

      setRoutes(result.routes);
      setSelectedRoute(result.shortestRoute);
      setAlternativeRoutes(result.alternativeRoutes);
      routeCoordsRef.current     = result.shortestRoute?.coordinates || [];
      routeProgressIndex.current = 0;
      offRouteCount.current      = 0;
      currentManeuverIndex.current = 0;
      spokenManeuvers.current.clear();
      lastRerouteTime.current = Date.now();

      if (result.shortestRoute) {
        setDistance(result.shortestRoute.distance / 1000);
        setDuration(Math.round(result.shortestRoute.duration / 60));
        setCompletedRouteCoords([]);
        setRemainingRouteCoords(result.shortestRoute.coordinates);
        setUsingApproximateRoute(false);
      }
      if (result.steps?.length) setRouteSteps(result.steps);
    } catch (e) {
      console.warn('[MapScreen] Reroute error:', e);
    } finally {
      routeFetchInFlight.current = false;
      if (isMounted.current) setIsRerouting(false);
    }
  }, []);

  // We pass destination via closure capture in navCallbackRef — see below.
  const checkOffRoute = useCallback((coords, distToRoute, dest) => {
    if (!isNavigating) return;
    if (!routeCoordsRef.current?.length) return;
    if (distToRoute == null) return;

    if (distToRoute > OFF_ROUTE_THRESHOLD_M) {
      offRouteCount.current += 1;
    } else {
      offRouteCount.current = 0;
    }

    if (offRouteCount.current >= OFF_ROUTE_CONFIRM_COUNT) {
      triggerReroute(coords, dest);
      offRouteCount.current = 0; // reset — triggerReroute has its own cooldown
    }
  }, [isNavigating, triggerReroute]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Stable navCallbackRef — always reflects latest callbacks & destination
  //  so the location subscriber (created once) never reads stale closures.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    navCallbackRef.current = newCoords => {
      const distToRoute = updateRouteProgress(newCoords);
      checkOffRoute(newCoords, distToRoute, destination);
      if (routeStepsRef.current.length > 0) {
        updateCurrentManeuver(newCoords, routeStepsRef.current);
      }
    };
  }, [updateRouteProgress, checkOffRoute, updateCurrentManeuver, destination]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Phase 1 — Camera Controller
  // ─────────────────────────────────────────────────────────────────────────
  const updateCamera = useCallback(
    (coords, heading = 0, animated = true) => {
      if (!mapRef.current || !coords) return;
      if (!isFollowingDriver.current) return;
      if (isFittingRoute.current) return; // don't fight fitToCoordinates

      const now = Date.now();
      if (now - lastCameraUpdateTime.current < CAMERA_THROTTLE_MS) return;

      if (cameraUpdateTimeout.current) clearTimeout(cameraUpdateTimeout.current);

      cameraUpdateTimeout.current = setTimeout(() => {
        try {
          if (lastCameraUpdate.current) {
            const moved = calculateHaversineDistance(lastCameraUpdate.current, coords);
            if (moved < 8 && animated) return;
          }

          const nav = tripStage === STAGES.GOING_TO_PICKUP || tripStage === STAGES.GOING_TO_DROP;
          const camera = {
            center:   coords,
            pitch:    nav ? NAV_PITCH : ARRIVED_PITCH,
            heading:  nav ? (heading + 360) % 360 : 0,
            altitude: 1200,
            zoom:     nav ? NAV_ZOOM : ARRIVED_ZOOM,
          };

          if (animated) {
            mapRef.current?.animateCamera(camera, { duration: 600 });
          } else {
            mapRef.current?.setCamera(camera);
          }

          lastCameraUpdate.current     = coords;
          lastCameraUpdateTime.current = Date.now();
        } catch (e) { console.error('[MapScreen] Camera error:', e); }
      }, 80);
    },
    [tripStage],
  );

  // Camera follow effect — triggers when driver moves
  useEffect(() => {
    if (!isMapReady || !driverCoords || !isFollowingDriver.current) return;
    const isActiveNav = tripStage === STAGES.GOING_TO_PICKUP || tripStage === STAGES.GOING_TO_DROP;
    if (!isActiveNav) return;

    if (!lastCameraUpdate.current) {
      updateCamera(driverCoords, arrowRotation, false);
    } else if (calculateHaversineDistance(lastCameraUpdate.current, driverCoords) > 15) {
      updateCamera(driverCoords, arrowRotation);
    }
  }, [driverCoords, tripStage, arrowRotation, updateCamera, isMapReady]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Phase 1 — Arrow Rotation with Look-ahead + Shortest-angle Smoothing
  // ─────────────────────────────────────────────────────────────────────────
  const updateArrowRotation = useCallback(() => {
    if (!driverCoords || !destination) return;
    try {
      const coords = routeCoordsRef.current;
      if (coords?.length > 1) {
        // Scan a limited window starting from last known index
        const scanStart = Math.max(0, routeProgressIndex.current - 2);
        const scanEnd   = Math.min(coords.length - 1, routeProgressIndex.current + 30);
        let closestIdx  = routeProgressIndex.current;
        let closestDist = Infinity;
        for (let i = scanStart; i <= scanEnd; i++) {
          const d = calculateHaversineDistance(driverCoords, coords[i]);
          if (d < closestDist) { closestDist = d; closestIdx = i; }
        }

        const lookAhead = Math.min(closestIdx + LOOK_AHEAD_POINTS, coords.length - 1);
        const rawBearing = calculateBearing(driverCoords, coords[lookAhead] || destination);
        const smoothed   = smoothAngle(lastStableHeading.current, rawBearing);
        lastStableHeading.current = smoothed;
        setArrowRotation(smoothed);
      } else {
        const rawBearing = calculateBearing(driverCoords, destination);
        const smoothed   = smoothAngle(lastStableHeading.current, rawBearing);
        lastStableHeading.current = smoothed;
        setArrowRotation(smoothed);
      }
    } catch (e) { console.error('[MapScreen] Bearing error:', e); }
  }, [driverCoords, destination]);

  useEffect(() => {
    if (!driverCoords || !destination) return;
    updateArrowRotation();
    directionInterval.current = setInterval(updateArrowRotation, 1000);
    return () => { if (directionInterval.current) clearInterval(directionInterval.current); };
  }, [driverCoords, destination, updateArrowRotation]);

  // tracksViewChanges — cap re-renders
  useEffect(() => {
    setTracksViewChanges(true);
    const t = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(t);
  }, [driverCoords?.latitude, driverCoords?.longitude, arrowRotation]);

  // Animate marker smoothly
  useEffect(() => {
    if (driverCoords) {
      animatedDriverCoords.timing({
        latitude: driverCoords.latitude, longitude: driverCoords.longitude,
        duration: 1500, useNativeDriver: false,
      }).start();
    }
  }, [driverCoords?.latitude, driverCoords?.longitude]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Route Fetch (on destination change or driver drift >150 m)
  // ─────────────────────────────────────────────────────────────────────────
  // NOTE: fetchAndDisplayShortestPath is defined as a plain async function
  // inside the component so its deps are always fresh from the closure.
  const fetchAndDisplayShortestPath = async () => {
    if (!driverCoords || !destination || !GOOGLE_MAPS_APIKEY) return;
    if (routeFetchInFlight.current) return;

    routeFetchInFlight.current = true;
    const version = ++routeFetchVersion.current;
    if (isMounted.current) setIsFetchingRoutes(true);

    try {
      const result = await fetchShortestPath(driverCoords, destination, travelMode);
      if (version !== routeFetchVersion.current || !isMounted.current) return;

      if (result) {
        setRoutes(result.routes);
        setSelectedRoute(result.shortestRoute);
        setAlternativeRoutes(result.alternativeRoutes);
        routeCoordsRef.current     = result.shortestRoute?.coordinates || [];
        routeProgressIndex.current = 0;
        offRouteCount.current      = 0;
        currentManeuverIndex.current = 0;
        spokenManeuvers.current.clear();

        if (result.shortestRoute) {
          setDistance(result.shortestRoute.distance / 1000);
          setDuration(Math.round(result.shortestRoute.duration / 60));
          setCompletedRouteCoords([]);
          setRemainingRouteCoords(result.shortestRoute.coordinates);
          setUsingApproximateRoute(false);
        }
        if (result.steps?.length) setRouteSteps(result.steps);

        // Fit once → then switch to 3D follow
        if (mapRef.current && result.shortestRoute?.coordinates?.length > 0) {
          isFittingRoute.current = true;
          mapRef.current.fitToCoordinates(result.shortestRoute.coordinates, {
            edgePadding: { top: 140, right: 60, bottom: 300, left: 60 },
            animated: true,
          });
          setTimeout(() => {
            isFittingRoute.current = false;
            if (isMounted.current && driverCoords && isFollowingDriver.current) {
              // Force camera update: bypass throttle for the initial switch
              lastCameraUpdateTime.current = 0;
              updateCamera(driverCoords, lastStableHeading.current, true);
            }
          }, 1600);
        }
      } else {
        setUsingApproximateRoute(true);
      }
    } catch (err) {
      console.error('[MapScreen] Route fetch error:', err);
      if (isMounted.current) setUsingApproximateRoute(true);
    } finally {
      routeFetchInFlight.current = false;
      if (isMounted.current) setIsFetchingRoutes(false);
    }
  };

  useEffect(() => {
    if (!driverCoords || !destination || !GOOGLE_MAPS_APIKEY) return;
    const destChanged = !lastDestination.current ||
      lastDestination.current.latitude  !== destination.latitude ||
      lastDestination.current.longitude !== destination.longitude;
    let shouldFetch = destChanged || !lastRouteFetchedCoords.current;

    if (!shouldFetch) {
      const drift = calculateHaversineDistance(driverCoords, lastRouteFetchedCoords.current);
      if (drift > 150) shouldFetch = true;
    }
    if (shouldFetch) {
      fetchAndDisplayShortestPath();
      lastRouteFetchedCoords.current = driverCoords;
      lastDestination.current        = destination;
      setRouteOrigin(driverCoords);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverCoords?.latitude, driverCoords?.longitude, destination?.latitude, destination?.longitude, travelMode]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Location Tracking — fully stable (startLocationTracking has no deps)
  // ─────────────────────────────────────────────────────────────────────────
  const stopLocationTracking = useCallback(() => {
    try {
      if (unsubscribeLocation.current) {
        unsubscribeLocation.current();
        unsubscribeLocation.current = null;
      }
      if (directionInterval.current) clearInterval(directionInterval.current);
    } catch (e) { console.error('[MapScreen] Stop tracking error:', e); }
  }, []);

  const startLocationTracking = useCallback(() => {
    try {
      LocationService.requestStartupPosition()
        .then(coords => {
          if (!coords || !isMounted.current) return;
          setDriverCoords(coords);
          lastKnownCoords.current = coords;
          setIsLoading(false);
          // Set initial 3D camera without triggering the throttle logic
          setTimeout(() => {
            if (mapRef.current && isMounted.current) {
              mapRef.current.setCamera({
                center: coords, pitch: NAV_PITCH,
                heading: 0, altitude: 1200, zoom: NAV_ZOOM,
              });
              lastCameraUpdate.current     = coords;
              lastCameraUpdateTime.current = Date.now();
            }
          }, 500);
        })
        .catch(error => {
          console.error('[MapScreen] Location startup error:', error);
          if (!isMounted.current) return;
          const fallback = LocationService.getLastCoords();
          if (fallback) setDriverCoords(fallback);
          setLocationError('Using approximate location');
          setIsLoading(false);
        });

      // Single subscriber — do not double-subscribe
      if (unsubscribeLocation.current) {
        unsubscribeLocation.current();
        unsubscribeLocation.current = null;
      }

      unsubscribeLocation.current = LocationService.subscribe(newCoords => {
        if (
          newCoords?.latitude  != null &&
          newCoords?.longitude != null &&
          newCoords.latitude  >= -90  && newCoords.latitude  <= 90 &&
          newCoords.longitude >= -180 && newCoords.longitude <= 180 &&
          isMounted.current
        ) {
          setDriverCoords(newCoords);
          lastKnownCoords.current = newCoords;
          // Use ref-based handler so closure is always fresh
          navCallbackRef.current?.(newCoords);
        }
      });

      if (isMounted.current) setIsLoading(false);
    } catch (e) {
      console.error('[MapScreen] startLocationTracking error:', e);
      if (isMounted.current) { setIsLoading(false); setLocationError('Could not start location tracking'); }
    }
  }, []); // intentionally stable — no deps

  // ── Permission ────────────────────────────────────────────────────────────
  useEffect(() => {
    const resolve = async () => {
      if (!hasPermission) {
        const granted = await getLocationPermission();
        dispatch(setLocationPermission(granted));
      }
    };
    resolve();
  }, [hasPermission, dispatch]);

  useEffect(() => {
    if (hasPermission) {
      startLocationTracking();
      try {
        updateService('on_trip', {
          orderId: order?.id || order?.rideId, pickup: pickupAddress, drop: dropAddress,
        });
      } catch (e) { console.error('Service update error:', e); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission]);

  // ── App State & Unmount Cleanup ───────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (hasPermission) startLocationTracking();
      }
      appState.current = nextAppState;
    });
    return () => {
      isMounted.current = false;
      subscription.remove();
      stopLocationTracking();
      if (cameraUpdateTimeout.current) clearTimeout(cameraUpdateTimeout.current);
      if (directionInterval.current)   clearInterval(directionInterval.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount — AppState listener is stable

  // ── Proximity Detection (pickup / drop arrived) ───────────────────────────
  useEffect(() => {
    if (!driverCoords || !pickup || !drop) return;
    const pickupDist = calculateHaversineDistance(driverCoords, pickup);
    const dropDist   = calculateHaversineDistance(driverCoords, drop);
    setIsAtPickup(pickupDist <= 60);
    setIsAtDrop(dropDist <= 50);

    if (pickupDist <= 60 && tripStage === STAGES.GOING_TO_PICKUP) {
      setTripStage(STAGES.ARRIVED_PICKUP);
      setShowDropRoute(true);
      const rideId = order?.rideId || order?.id;
      SocketService.emitDriverArrived(rideId, {
        type: 'Point', coordinates: [driverCoords.longitude, driverCoords.latitude],
      });
      driverApi.arrivedAtPickup(rideId).catch(err => {
        if (err?.response?.status !== 404) console.error('arrivedAtPickup error:', err);
      });
    }
    if (dropDist <= 50 && tripStage === STAGES.GOING_TO_DROP) {
      setTripStage(STAGES.ARRIVED_DROP);
    }
  }, [driverCoords, pickup, drop, tripStage]);

  // ── Distance calculation (ETA display + arrived detection) ───────────────
  useEffect(() => {
    if (!driverCoords || !destination) return;
    try {
      const d = calculateHaversineDistance(driverCoords, destination);
      if (isNaN(d) || d < 0) return;
      if (!selectedRoute) setDistance(d / 1000);

      if (d <= 60 && tripStage === STAGES.GOING_TO_PICKUP) {
        setTripStage(STAGES.ARRIVED_PICKUP);
        if (mapRef.current) updateCamera(pickup, 0);
        toast.info('You have reached pickup location. Confirm pickup now.');
        speakInstruction('You have arrived at the pickup location.', 'arrived-pickup');
      }
      if (d <= 50 && tripStage === STAGES.GOING_TO_DROP) {
        setTripStage(STAGES.ARRIVED_DROP);
        if (mapRef.current) updateCamera(drop, 0);
        toast.info('You have reached the destination. Complete delivery when ready.');
        speakInstruction('You have arrived at your destination.', 'arrived-drop');
      }
    } catch (e) { console.error('Distance calc error:', e); setDistance(null); }
  }, [destination, driverCoords, tripStage, pickup, drop, updateCamera, selectedRoute, speakInstruction]);

  // ── Socket location emitter (every 3 s) ─────────────────────────────────
  useEffect(() => {
    if (!driverCoords || tripStage === STAGES.COMPLETED) return;
    const iv = setInterval(() => {
      try {
        SocketService.emitLocation(
          driverCoords.latitude, driverCoords.longitude, arrowRotation || 0, 0,
        );
      } catch (e) { console.error('Socket emit error:', e); }
    }, 3000);
    return () => clearInterval(iv);
  }, [driverCoords, arrowRotation, tripStage]);

  useEffect(() => {
    const handleRideCancelled = async (data) => {
      const rideId = order?.rideId || order?.id || initialOrder?.rideId || initialOrder?.id;
      if (data?.rideId === rideId || data?.id === rideId) {
        toast.info('Ride cancelled by admin/customer.');
        await clearActiveOrder();
        navigation.navigate('MyTabs', { screen: 'Home' });
      }
    };

    SocketService.on('ride:cancelled', handleRideCancelled);
    SocketService.on('ride_cancelled', handleRideCancelled);

    return () => {
      SocketService.off('ride:cancelled', handleRideCancelled);
      SocketService.off('ride_cancelled', handleRideCancelled);
    };
  }, [order, initialOrder, navigation]);

  // ─────────────────────────────────────────────────────────────────────────
  //  Handlers
  // ─────────────────────────────────────────────────────────────────────────

  const handleSelectRoute = r => {
    setSelectedRoute(r);
    routeCoordsRef.current     = r.coordinates || [];
    routeProgressIndex.current = 0;
    setCompletedRouteCoords([]);
    setRemainingRouteCoords(r.coordinates);
    setDistance(r.distance / 1000);
    setDuration(Math.round(r.duration / 60));
    setShowRouteOptions(false);
    if (mapRef.current && r.coordinates.length > 0) {
      mapRef.current.fitToCoordinates(r.coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 200, left: 50 }, animated: true,
      });
    }
  };

  /** Restore 3D follow mode after manual map pan. */
  const handleRecenter = useCallback(() => {
    isFollowingDriver.current = true;
    setIsFollowingDriverState(true);
    if (driverCoords && mapRef.current) {
      lastCameraUpdateTime.current = 0; // bypass throttle for immediate re-center
      updateCamera(driverCoords, lastStableHeading.current, true);
    }
  }, [driverCoords, updateCamera]);

  const handleCallCustomer = () => {
    const phone = order?.receiver?.phone || order?.customer?.phone;
    if (!phone) { toast.error('Customer phone number is not available for this order.'); return; }
    const url = `tel:${phone}`;
    Linking.canOpenURL(url)
      .then(s => { if (s) Linking.openURL(url); else toast.error(`Unable to call. Please dial ${phone} manually.`); })
      .catch(() => toast.error('Failed to initiate call.'));
  };

  const handleCancelTrip = async () => {
    if (!cancelReason) { toast.warn('Please select a reason for cancellation.'); return; }
    const cancelId = order?.rideId || order?.id || initialOrder?.rideId || initialOrder?.id;
    setIsCancelling(true);
    try { await driverApi.cancelOrder(cancelId, cancelReason); } catch (e) {
      console.log('Cancel status:', e?.response?.status, e?.response?.data);
    }
    await setActiveOrder(null);
    await addNotification({ title: 'Trip Cancelled', body: `Order ${cancelId} cancelled: ${cancelReason}`, type: 'order', data: order });
    setIsCancelling(false);
    setShowCancelModal(false);
    setCancelReason('');
    SocketService.emitStatusChange(true, true);
    SocketService.clearActiveRide();
    try { await updateService('online'); } catch (e) {}
    stopLocationTracking();
    navigation.navigate('MyTabs');
  };

  const handlePickupOtpSubmit = async () => {
    const expected = order?.pickupCode || order?.otp || order?.pickup_otp;
    if (expected && pickupOtp !== String(expected)) {
      toast.error('The pickup verification code is incorrect. Please check with the customer.'); return;
    }
    if (pickupOtp.length < 4) { toast.warn('Please enter the 4-digit pickup verification code.'); return; }
    setShowPickupOtpModal(false);
    setPickupOtp('');
    handlePickupConfirmActual();
  };

  const handlePickupConfirmActual = async () => {
    try {
      setTripStage(STAGES.GOING_TO_DROP);
      setShowDropRoute(true);

      // Reset navigation state for new destination (drop)
      routeProgressIndex.current   = 0;
      offRouteCount.current        = 0;
      currentManeuverIndex.current = 0;
      spokenManeuvers.current.clear();
      routeCoordsRef.current = [];
      lastDestination.current = null; // forces route re-fetch for drop
      setCompletedRouteCoords([]);
      setRemainingRouteCoords([]);
      setCurrentManeuver(null);
      setRouteSteps([]);

      const rideId = order?.rideId || order?.id;
      SocketService.emitRideStarted(rideId);

      const updated = await driverApi.startRide(rideId).catch(() =>
        driverApi.confirmPickup(order.id).catch(() => null),
      );
      if (updated) { await setActiveOrder(updated); }
      else         { await setActiveOrder({ ...order, status: 'picked_up' }); }

      await addNotification({
        title: 'Pickup Confirmed',
        body:  `${order.id} pickup confirmed. Navigate to drop.`,
        type: 'order',
        data: { ...order, status: 'picked_up' },
      });
      await updateServiceBody(
        `Order #${String(order?.id || '').slice(-6).toUpperCase()} — Heading to Drop\n🏁 ${dropAddress}`,
      );

      speakInstruction('Pickup confirmed. Navigating to drop location.', 'pickup-confirmed');

      if (mapRef.current && driverCoords) updateCamera(driverCoords, arrowRotation);
    } catch (e) {
      console.error('Pickup confirmation error:', e);
      toast.error('Failed to confirm pickup. Please try again.');
    }
  };

  const rideAmount =
    order?.amount || order?.fare || order?.rideDetails?.estimatedFare || normalizedOrder?.amount || 0;

  const handleCompleteDelivery = () => {
    setCashCollected(order?.amount?.toString() || '');
    setPaymentMethod('cash');
    setModalError('');
    setShowCashModal(true);
  };

  const handleCashCollected = async () => {
    try {
      if (paymentMethod === 'cash') {
        if (!cashCollected) { setModalError('Please enter the amount collected'); return; }
        const v = parseFloat(cashCollected);
        if (isNaN(v) || v <= 0) { setModalError('Please enter a valid amount'); return; }
      }
      setModalError('');
      setIsProcessing(true);

      const amount  = paymentMethod === 'cash' ? parseFloat(cashCollected) : (order?.amount || order?.fare || 0);
      const rideId  = order?.rideId || order?.id;

      let serverCompleted = null;
      try { serverCompleted = await driverApi.completeRide(rideId, amount, paymentMethod); }
      catch { try { serverCompleted = await driverApi.completeOrder(order.id, distance || 0); } catch {} }

      SocketService.emitRideCompleted(rideId, amount, paymentMethod);
      SocketService.clearActiveRide();

      const completedOrder = await completeOrder({
        ...order, ...(serverCompleted || {}), drop, pickup, pickupAddress, dropAddress,
        deliveredDistanceKm: distance, amount, paymentMethod, completedAt: new Date().toISOString(),
      });

      await addNotification({
        title: 'Delivery Completed',
        body:  `${completedOrder.id} completed. ₹${amount} collected via ${paymentMethod}.`,
        type:  'order', data: completedOrder,
      });

      setTripStage(STAGES.COMPLETED);
      setShowCashModal(false);
      isFollowingDriver.current = false; // stop following on completion

      await updateService('online');
      stopLocationTracking();

      Alert.alert(
        'Delivery Complete',
        `Order delivered successfully. ₹${amount} collected.\nYour earnings: ₹${(amount * 0.8).toFixed(2)}`,
        [{ text: 'Go Home', onPress: () => navigation.navigate('MyTabs') }],
      );
    } catch (e) {
      console.error('Completion error:', e);
      setModalError('Failed to complete delivery. Please try again.');
    } finally { setIsProcessing(false); }
  };

  // getVehicleImage() removed — use driverMarkerImage (useMemo) which handles
  // all vehicle type variants via includes() matching.

  // ─────────────────────────────────────────────────────────────────────────
  //  Loading guard
  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  const mapCenter = driverCoords || pickup || { latitude: 22.7261, longitude: 75.8931 };

  // ═════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        {/* ── MAP ──────────────────────────────────────────────────────────── */}
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude:      mapCenter.latitude,
            longitude:     mapCenter.longitude,
            latitudeDelta:  0.01,
            longitudeDelta: 0.01,
          }}
          onMapReady={() => setIsMapReady(true)}
          pitchEnabled={true}
          rotateEnabled={true}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={true}
          showsBuildings={true}
          loadingEnabled={true}
          moveOnMarkerPress={false}
          toolbarEnabled={false}
          zoomControlEnabled={false}
          liteMode={false}
          /** Phase 1: Detect manual pan → disable follow mode */
          onPanDrag={() => {
            if (isFollowingDriver.current) {
              isFollowingDriver.current = false;
              setIsFollowingDriverState(false);
            }
          }}
        >
          {/* ── Driver Vehicle Marker — image matches driver's vehicle type ── */}
          {driverCoords && (
            <Marker.Animated
              coordinate={animatedDriverCoords}
              anchor={{ x: 0.5, y: 0.5 }}
              flat={true}
              tracksViewChanges={tracksViewChanges}
            >
              <Image
                source={driverMarkerImage}
                style={{ width: 50, height: 50, transform: [{ rotate: `${arrowRotation || 0}deg` }] }}
                resizeMode="contain"
              />
            </Marker.Animated>
          )}

          {/* ── Pickup Marker ──────────────────────────────────────────────── */}
          {pickup && (
            <Marker coordinate={pickup} anchor={{ x: 0.5, y: 1.0 }}>
              <Image source={imgPath.ic_pick} style={{ width: 50, height: 50 }} resizeMode="contain" />
            </Marker>
          )}

          {/* ── Drop Marker ────────────────────────────────────────────────── */}
          {showDropRoute && drop && (
            <Marker coordinate={drop} anchor={{ x: 0.5, y: 1.0 }}>
              <Image source={imgPath.ic_drop} style={{ width: 50, height: 50 }} resizeMode="contain" />
            </Marker>
          )}

          {/* ── Phase 2: Completed Route (grey) ───────────────────────────── */}
          {completedRouteCoords.length > 1 && (
            <Polyline
              coordinates={completedRouteCoords}
              strokeWidth={5}
              strokeColor="rgba(155,155,155,0.65)"
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* ── Phase 2: Remaining Route (brand colour) ────────────────────── */}
          {remainingRouteCoords.length > 1 && (
            <Polyline
              coordinates={remainingRouteCoords}
              strokeWidth={7}
              strokeColor={theme.colors.primary}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={[0]}
            />
          )}

          {/* ── Fallback: full route before progress is computed ─────────────
              Shown briefly after route fetch while progress index is 0 */}
          {remainingRouteCoords.length <= 1 &&
            completedRouteCoords.length <= 1 &&
            routeCoordsRef.current.length > 1 && (
              <Polyline
                coordinates={routeCoordsRef.current}
                strokeWidth={7}
                strokeColor={theme.colors.primary}
                lineCap="round"
                lineJoin="round"
              />
            )}
        </MapView>

        {/* ── ROUTE OPTIONS MODAL ───────────────────────────────────────────── */}
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
                      style={[styles.travelModeButton, travelMode === mode && styles.travelModeButtonActive]}
                      onPress={() => setTravelMode(mode)}
                    >
                      <Text style={styles.travelModeButtonText}>
                        {mode === 'driving'   && '🚗'}
                        {mode === 'walking'   && '🚶'}
                        {mode === 'bicycling' && '🚲'}
                        {mode === 'transit'   && '🚌'}
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
                  routes.map((r, idx) => (
                    <TouchableOpacity
                      key={`route-${idx}`}
                      style={[styles.routeOption, selectedRoute === r && styles.routeOptionSelected]}
                      onPress={() => handleSelectRoute(r)}
                    >
                      <View style={styles.routeOptionHeader}>
                        <Text style={styles.routeOptionTitle}>
                          {idx === 0 ? ' Shortest Route' : ` Alternative ${idx}`}
                        </Text>
                        {selectedRoute === r && <Text style={styles.routeOptionCheck}>✓</Text>}
                      </View>
                      <Text style={styles.routeOptionSummary}>{r.summary || 'via main roads'}</Text>
                      <View style={styles.routeOptionDetails}>
                        <Text style={styles.routeOptionDistance}>{(r.distance / 1000).toFixed(1)} km</Text>
                        <Text style={styles.routeOptionDuration}>{Math.round(r.duration / 60)} min</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ── APPROXIMATE ROUTE BANNER ──────────────────────────────────────── */}
        {usingApproximateRoute && !selectedRoute && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Using approximate route. Tap route info to find shortest path.
            </Text>
          </View>
        )}

        {/* ── MAP HEADER (Back Button) ──────────────────────────────────────── */}
        <View style={styles.mapHeaderOverlay}>
          <TouchableOpacity style={styles.backBtnRound} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.ink} />
          </TouchableOpacity>
        </View>

        {/* ── Phase 4: MANEUVER INSTRUCTION CARD ───────────────────────────── */}
        {isNavigating && currentManeuver && (
          <View style={styles.maneuverCard}>
            <View style={styles.maneuverIconBox}>
              <Text style={styles.maneuverIconText}>{currentManeuver.icon}</Text>
            </View>
            <View style={styles.maneuverTextBox}>
              <Text style={styles.maneuverInstruction} numberOfLines={2}>
                {currentManeuver.instruction}
              </Text>
              <Text style={styles.maneuverDistance}>
                {currentManeuver.distanceMeters > 1000
                  ? `${(currentManeuver.distanceMeters / 1000).toFixed(1)} km`
                  : `${currentManeuver.distanceMeters} m`}
              </Text>
            </View>
          </View>
        )}

        {/* ── Phase 3: REROUTING INDICATOR ─────────────────────────────────── */}
        {isRerouting && (
          <View style={styles.reroutingBanner}>
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.reroutingText}>Recalculating route…</Text>
          </View>
        )}

        {/* ── Phase 1: RE-CENTER BUTTON ─────────────────────────────────────── */}
        {!isFollowingDriverState && isNavigating && (
          <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter} activeOpacity={0.85}>
            <Ionicons name="navigate" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        )}

        {/* ── BOTTOM NAVIGATION CARD (Preserved exactly) ───────────────────── */}
        <View style={styles.navCardOverlay}>
          {/* Distance / Time / Amount row */}
          <View style={styles.navInfoRow}>
            <View style={styles.navInfoItem}>
              <Text style={styles.navInfoLabel}>DISTANCE</Text>
              <Text style={styles.navInfoValue}>
                {distance != null ? `${Number(distance).toFixed(1)} km` : '--'}
              </Text>
            </View>
            <View style={styles.navInfoDivider} />
            <View style={styles.navInfoItem}>
              <Text style={styles.navInfoLabel}>TIME</Text>
              <Text style={styles.navInfoValue}>
                {duration != null ? `${duration} min` : '--'}
              </Text>
            </View>
            <>
              <View style={styles.navInfoDivider} />
              <View style={styles.navInfoItem}>
                <Text style={styles.navInfoLabel}>Amount</Text>
                <Text style={[styles.navInfoValue, { color: theme.colors.success }]}>
                  ₹{rideAmount}
                </Text>
              </View>
            </>
          </View>

          {/* Address row */}
          <View style={styles.addressCard}>
            <View style={styles.addressIndicatorCol}>
              <View style={[styles.addressDot, {
                backgroundColor: tripStage.includes('PICKUP') ? theme.colors.success : theme.colors.danger,
              }]} />
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
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.phoneCircle} onPress={handleCallCustomer}>
                <Ionicons name="call" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.phoneCircle, { backgroundColor: '#0080ff' }]}
                onPress={() => navigation.navigate('DriverChat', { rideId: order?.rideId || order?.id })}
              >
                <Ionicons name="chatbubble" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRowPrimary}>
            {tripStage === STAGES.GOING_TO_PICKUP && (
              isAtPickup ? (
                <TouchableOpacity style={styles.primaryActionBtn} onPress={() => setTripStage(STAGES.ARRIVED_PICKUP)} activeOpacity={0.8}>
                  <Text style={styles.primaryActionText}>ARRIVED AT PICKUP</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.disabledActionMsg}>
                  <Text style={styles.disabledActionText}>Reach pickup location to mark arrived</Text>
                </View>
              )
            )}
            {tripStage === STAGES.ARRIVED_PICKUP && (
              <TouchableOpacity style={[styles.primaryActionBtn, { backgroundColor: theme.colors.success }]} onPress={handlePickupConfirmActual} activeOpacity={0.8}>
                <Text style={styles.primaryActionText}>START TRIP</Text>
              </TouchableOpacity>
            )}
            {tripStage === STAGES.GOING_TO_DROP && isAtDrop && (
              <TouchableOpacity style={styles.primaryActionBtn} onPress={() => setTripStage(STAGES.ARRIVED_DROP)} activeOpacity={0.8}>
                <Text style={styles.primaryActionText}>ARRIVED AT DROP</Text>
              </TouchableOpacity>
            )}
            {tripStage === STAGES.GOING_TO_DROP && !isAtDrop && (
              <View style={styles.disabledActionMsg}>
                <Text style={styles.disabledActionText}>Reach drop location to mark arrived</Text>
              </View>
            )}
            {tripStage === STAGES.ARRIVED_DROP && (
              <TouchableOpacity style={[styles.primaryActionBtn, { backgroundColor: theme.colors.success }]} onPress={handleCompleteDelivery} activeOpacity={0.8}>
                <Text style={styles.primaryActionText}>COMPLETE ORDER</Text>
              </TouchableOpacity>
            )}
          </View>

          {tripStage === STAGES.GOING_TO_PICKUP && (
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <TouchableOpacity style={styles.cancelTripButton} onPress={() => setShowCancelModal(true)} activeOpacity={0.8}>
                <Text style={{ color: '#ff0303', fontSize: 13, fontWeight: '600' }}>Cancel trip</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── CANCEL TRIP MODAL ─────────────────────────────────────────────── */}
        <Modal visible={showCancelModal} transparent animationType="slide" onRequestClose={() => !isCancelling && setShowCancelModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Cancel Trip</Text>
                <TouchableOpacity onPress={() => !isCancelling && setShowCancelModal(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtext}>Select a reason for cancellation:</Text>
              {['Vehicle breakdown','Customer not reachable','Wrong address','Personal emergency','Other'].map(reason => (
                <TouchableOpacity
                  key={reason}
                  style={[styles.cancelReasonItem, cancelReason === reason && styles.cancelReasonActive]}
                  onPress={() => setCancelReason(reason)}
                  disabled={isCancelling}
                >
                  <Ionicons name={cancelReason === reason ? 'radio-button-on' : 'radio-button-off'} size={20} color={cancelReason === reason ? theme.colors.danger : '#999'} />
                  <Text style={[styles.cancelReasonText, cancelReason === reason && styles.cancelReasonTextActive]}>{reason}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.dangerBtn, isCancelling && styles.disabledBtn]}
                onPress={handleCancelTrip}
                disabled={isCancelling}
              >
                {isCancelling ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionBtnText}>Cancel Trip</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── PICKUP OTP MODAL ──────────────────────────────────────────────── */}
        <Modal visible={showPickupOtpModal} transparent animationType="slide" onRequestClose={() => setShowPickupOtpModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Pickup Verification</Text>
                <TouchableOpacity onPress={() => setShowPickupOtpModal(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtext}>Enter the 4-digit code provided by the customer to verify pickup:</Text>
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
              <TouchableOpacity style={[styles.modalActionBtn, styles.primaryBtn]} onPress={handlePickupOtpSubmit}>
                <Text style={styles.modalActionBtnText}>✅ Verify &amp; Confirm Pickup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── CASH COLLECTION MODAL ─────────────────────────────────────────── */}
        <Modal visible={showCashModal} transparent animationType="slide" onRequestClose={() => !isProcessing && setShowCashModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>💰 Payment Collection</Text>
                <TouchableOpacity onPress={() => !isProcessing && setShowCashModal(false)} disabled={isProcessing}>
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
                {['cash','card','online'].map(method => (
                  <TouchableOpacity
                    key={method}
                    style={[styles.paymentMethod, paymentMethod === method && styles.paymentMethodActive]}
                    onPress={() => { setPaymentMethod(method); setModalError(''); }}
                    disabled={isProcessing}
                  >
                    <Text style={[styles.paymentMethodText, paymentMethod === method && styles.paymentMethodTextActive]}>
                      {method === 'cash'   && '💵 Cash'}
                      {method === 'card'   && '💳 Card'}
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
                    onChangeText={t => { setCashCollected(t); setModalError(''); }}
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
              {!!modalError && <Text style={styles.modalErrorText}>{modalError}</Text>}
              <TouchableOpacity
                style={[styles.collectButton, isProcessing && styles.disabledBtn]}
                onPress={handleCashCollected}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                {isProcessing
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.collectButtonText}>{paymentMethod === 'cash' ? '✅ Cash Collected' : '✅ Confirm Payment'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </View>
    </ErrorBoundary>
  );
};

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F8F9FA' },
  map:              { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg, padding: 20 },
  loadingText:      { fontSize: 16, color: '#6B7280', marginTop: 10 },
  errorContainer:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 20 },
  errorTitle:       { fontSize: 18, fontWeight: 'bold', color: '#ff4444', marginBottom: 20 },
  retryButton:      { backgroundColor: theme.colors.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  retryButtonText:  { color: theme.colors.ink, fontSize: 16, fontWeight: '600' },

  // ── Banners ───────────────────────────────────────────────────────────────
  banner: {
    position: 'absolute', top: 10, left: 20, right: 20,
    backgroundColor: theme.colors.primary, padding: 12, borderRadius: 10,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 4 } }),
  },
  bannerText: { color: '#111827', fontSize: 13, textAlign: 'center' },

  // ── Map Header ────────────────────────────────────────────────────────────
  mapHeaderOverlay: {
    position: 'absolute', top: moderateScale(10), left: moderateScale(16), right: moderateScale(16),
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
  },
  backBtnRound: {
    width: moderateScale(48), height: moderateScale(48), borderRadius: moderateScale(24),
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    ...theme.shadow.card,
  },

  // ── Phase 4: Maneuver Card ────────────────────────────────────────────────
  maneuverCard: {
    position: 'absolute',
    top: moderateScale(72),
    left: moderateScale(16),
    right: moderateScale(16),
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    borderLeftWidth: 5,
    borderLeftColor: theme.colors.primary,
    zIndex: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  maneuverIconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: (theme.colors.primary || '#000') + '22',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  maneuverIconText:     { fontSize: 24 },
  maneuverTextBox:      { flex: 1 },
  maneuverInstruction:  { fontSize: moderateScale(14), fontWeight: '800', color: '#111827', lineHeight: 20 },
  maneuverDistance:     { fontSize: moderateScale(12), color: '#6B7280', marginTop: 3, fontWeight: '600' },

  // ── Phase 3: Rerouting Banner ─────────────────────────────────────────────
  reroutingBanner: {
    position: 'absolute',
    top: moderateScale(72),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 30,
    zIndex: 20,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }, android: { elevation: 8 } }),
  },
  reroutingText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ── Phase 1: Re-center Button ─────────────────────────────────────────────
  recenterButton: {
    position: 'absolute',
    right: moderateScale(16),
    bottom: moderateScale(320),
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 15,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
      android: { elevation: 8 },
    }),
  },

  // ── Bottom Navigation Card ────────────────────────────────────────────────
  navCardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: theme.radii.xl, borderTopRightRadius: theme.radii.xl,
    padding: moderateScale(20),
    paddingBottom: Platform.OS === 'ios' ? moderateScale(40) : moderateScale(25),
    ...theme.shadow.card, elevation: 20,
  },
  navInfoRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: moderateScale(18) },
  navInfoItem:     { flex: 1, alignItems: 'center' },
  navInfoLabel:    { fontSize: moderateScale(10), fontWeight: '800', color: theme.colors.muted, marginBottom: 4 },
  navInfoValue:    { fontSize: moderateScale(16), fontWeight: '900', color: theme.colors.ink },
  navInfoDivider:  { width: 1, height: 20, backgroundColor: theme.colors.border },
  addressCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.bg, borderRadius: theme.radii.lg, padding: moderateScale(12), marginBottom: moderateScale(20) },
  addressIndicatorCol: { alignItems: 'center', marginRight: moderateScale(12) },
  addressDot:      { width: 12, height: 12, borderRadius: 6 },
  addressLine:     { width: 2, height: 20, backgroundColor: theme.colors.border, marginTop: 4 },
  addressTextCol:  { flex: 1 },
  addressLabel:    { fontSize: moderateScale(10), fontWeight: '800', color: theme.colors.muted },
  addressText:     { fontSize: moderateScale(13), fontWeight: '700', color: theme.colors.ink, marginTop: 2 },
  phoneCircle:     { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.ink, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  actionRowPrimary:{ width: '100%' },
  primaryActionBtn:{ backgroundColor: theme.colors.ink, borderRadius: theme.radii.md, paddingVertical: moderateScale(16), alignItems: 'center', justifyContent: 'center' },
  primaryActionText:{ color: '#fff', fontWeight: '900', fontSize: moderateScale(16), letterSpacing: 1.2 },
  disabledActionMsg:{ padding: 12, borderRadius: 8, backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#d1d5db', marginBottom: 8 },
  disabledActionText:{ color: '#6b7280', fontSize: 12, textAlign: 'center' },
  cancelTripButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },

  // ── Modals ────────────────────────────────────────────────────────────────
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent:    {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }, android: { elevation: 5 } }),
  },
  routeModalContent:{ maxHeight: height * 0.7 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  closeButton:     { fontSize: 24, color: '#9CA3AF', padding: 4 },
  modalSubtext:    { fontSize: 14, color: '#6B7280', marginBottom: 14 },
  modalActionBtn:  { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  dangerBtn:       { backgroundColor: theme.colors.danger || '#ff4444' },
  primaryBtn:      { backgroundColor: theme.colors.primary },
  modalActionBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  disabledBtn:     { opacity: 0.6 },
  cancelReasonItem:{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, marginBottom: 4 },
  cancelReasonActive:{ backgroundColor: '#2A1010' },
  cancelReasonText:{ marginLeft: 10, fontSize: 14, color: '#6B7280' },
  cancelReasonTextActive:{ fontWeight: '600', color: theme.colors.danger },
  otpInput:        { fontSize: 32, fontWeight: '800', color: '#111827', borderWidth: 2, borderColor: theme.colors.primary, borderRadius: 12, paddingVertical: 16, marginBottom: 20, letterSpacing: 12 },
  travelModeContainer:{ marginBottom: 20 },
  travelModeLabel: { fontSize: 14, color: '#6B7280', marginBottom: 8, fontWeight: '600' },
  travelModeButtons:{ flexDirection: 'row', justifyContent: 'space-around' },
  travelModeButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  travelModeButtonActive:{ backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  travelModeButtonText:{ fontSize: 24 },
  routesList:      { maxHeight: height * 0.4 },
  loadingRoutes:   { padding: 40, alignItems: 'center' },
  loadingRoutesText:{ marginTop: 10, color: '#6B7280', fontSize: 14 },
  routeOption:     { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  routeOptionSelected:{ borderColor: theme.colors.primary, backgroundColor: (theme.colors.primary || '#000') + '10' },
  routeOptionHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  routeOptionTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  routeOptionCheck: { fontSize: 18, color: theme.colors.success, fontWeight: 'bold' },
  routeOptionSummary:{ fontSize: 13, color: '#6B7280', marginBottom: 8 },
  routeOptionDetails:{ flexDirection: 'row', justifyContent: 'space-between' },
  routeOptionDistance:{ fontSize: 13, color: '#6B7280' },
  routeOptionDuration:{ fontSize: 13, color: '#6B7280' },
  orderSummary:    { backgroundColor: '#F8F9FA', padding: 16, borderRadius: 12, marginBottom: 20 },
  summaryText:     { fontSize: 14, color: '#6B7280', marginVertical: 2 },
  paymentMethods:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  paymentMethod:   { flex: 1, paddingVertical: 12, marginHorizontal: 4, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  paymentMethodActive:{ backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  paymentMethodText:{ fontSize: 13, color: '#6B7280' },
  paymentMethodTextActive:{ color: theme.colors.ink, fontWeight: '600' },
  amountInputContainer:{ marginBottom: 20 },
  amountLabel:     { fontSize: 14, color: '#6B7280', marginBottom: 8, fontWeight: '600' },
  amountInput:     { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 16, fontSize: 16, color: '#111827' },
  inputError:      { borderColor: '#ff4444' },
  amountDisplay:   { backgroundColor: '#F8F9FA', padding: 16, borderRadius: 10, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountDisplayLabel:{ fontSize: 14, color: '#6B7280' },
  amountDisplayValue:{ fontSize: 18, fontWeight: 'bold', color: theme.colors.success },
  collectButton:   { backgroundColor: theme.colors.success, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  collectButtonText:{ color: '#fff', fontWeight: '700', fontSize: 16 },
  modalErrorText:  { color: '#ff4444', fontSize: 14, textAlign: 'center', marginBottom: 12 },
});

export default MapScreen;
