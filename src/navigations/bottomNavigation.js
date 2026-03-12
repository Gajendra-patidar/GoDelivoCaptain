import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import HomeScreen from '../screens/home/HomeScreen';
import MoreScreen from '../screens/more/MoreScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HelpSupports from '../screens/helpsupport/HelpSupports';
import { theme } from '../theme';

const Tab = createBottomTabNavigator();

function MyTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,

        tabBarIcon: ({ focused }) => {
          let iconName;
          let color = focused ? theme.colors.primary : '#9e8e46';

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Help') {
            iconName = 'headset';
          } else if (route.name === 'More') {
            iconName = 'grid';
          }

          return (
            <View style={styles.iconWrapper}>
              <Ionicons name={iconName} size={26} color={color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Help" component={HelpSupports} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
  );
}

export default MyTabs;

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 2,
    left: 20,
    right: 20,
    height: 55,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    marginHorizontal: 15,
    paddingTop: 10,
    ...theme.shadow.card,
  },

  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
