import { StyleSheet, View, Image, StatusBar } from 'react-native';
import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { driverApi } from '../../services/driverApi';

const SplashScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const checkTokenAndNavigate = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');

        console.log("user token", token);

        if (token) {
          navigation.replace('Docs');
        } else {
          navigation.replace('Login');
        }
      } catch (error) {
        console.log("Splash error:", error);
        navigation.replace('Login');
      }
    };

    checkTokenAndNavigate();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#FFD700" barStyle="dark-content" />
      <Image
        source={require('../../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
});
