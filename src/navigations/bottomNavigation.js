import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import HomeScreen from '../screens/home/HomeScreen';
import MoreScreen from '../screens/more/MoreScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HelpSupports from '../screens/helpsupport/HelpSupports';

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
          let color = focused ? '#F4C20D' : '#9e8e46';

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
    bottom: 15,
    left: 20,
    right: 20,
    height: 55,
    borderRadius: 40,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#F4C20D',
    elevation: 0, // no shadow
    marginHorizontal:15,
    paddingTop:10
  },

  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});