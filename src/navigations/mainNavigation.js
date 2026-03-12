import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MyTabs from './bottomNavigation';
import SplashScreen from '../screens/splash/SplashScreen';
import DocumentScreen from '../screens/documents/DocumentScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import MapScreen from '../screens/map/MapScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import EarningsScreen from '../screens/earnings/EarningsScreen';
import OrderHistoryScreen from '../screens/history/OrderHistoryScreen';
import NotificationScreen from '../screens/notifications/NotificationScreen';
import TripDetailScreen from '../screens/history/TripDetailScreen';
import IncentivesScreen from '../screens/incentives/IncentivesScreen';
import HelpDetailScreen from '../screens/helpsupport/HelpDetailScreen';
import ReferralScreen from '../screens/referral/ReferralScreen';

const Stack = createNativeStackNavigator();

function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="MyTabs" component={MyTabs} />
      <Stack.Screen name="Docs" component={DocumentScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="Earnings" component={EarningsScreen} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="TripDetail" component={TripDetailScreen} />
      <Stack.Screen name="Incentives" component={IncentivesScreen} />
      <Stack.Screen name="HelpDetail" component={HelpDetailScreen} />
      <Stack.Screen name="Referral" component={ReferralScreen} />
    </Stack.Navigator>
  );
}

export default function MainNavigation() {
  return (
    <NavigationContainer>
      <RootStack />
    </NavigationContainer>
  );
}
