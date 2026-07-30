import * as React from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
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
import JoiningFeesScreen from '../screens/earnings/JoiningFeesScreen';
import CommingSoonScreen from '../screens/CommingSoon/CommingSoonScreen';
import DriverChatScreen from '../screens/chat/DriverChatScreen';
import SubscriptionScreen from '../screens/subscription/SubscriptionScreen';
import NetworkErrorScreen from '../screens/networkError/NetworkErrorScreen';
import navigationRef from '../navigations/navigationRef';
import { getThemeForScheme } from '../theme';

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
      <Stack.Screen name="JoinFees" component={JoiningFeesScreen} />
      <Stack.Screen name="CommingSoon" component={CommingSoonScreen} />
      <Stack.Screen name="DriverChat" component={DriverChatScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="Network-error" component={NetworkErrorScreen} />
    </Stack.Navigator>
  );
}

export default function MainNavigation() {
  const appTheme = getThemeForScheme('dark');
  const navigationTheme = {
    ...(appTheme.mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(appTheme.mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: appTheme.colors.primary,
      background: appTheme.colors.bg,
      card: appTheme.colors.surface,
      text: appTheme.colors.text,
      border: appTheme.colors.border,
      notification: appTheme.colors.primary,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <RootStack />
    </NavigationContainer>
  );
}
