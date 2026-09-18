import React, { useEffect, useRef } from 'react';

import {
  View,
  Alert,
} from 'react-native';

import {
  NavigationContainer,
} from '@react-navigation/native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import LoginScreen from './screens/LoginScreen';
import MFAScreen from './screens/MFAScreen';
import HomeScreen from './screens/HomeScreen';
import ScannerScreen from './screens/ScannerScreen';
import ResultScreen from './screens/ResultScreen';
import CaptureEvidenceScreen from './screens/CaptureEvidenceScreen';
import FaceMatchResultScreen from './screens/FaceMatchResultScreen';
import DatabaseSearchScreen from './screens/DatabaseSearchScreen';
import EvidenceUploadScreen from './screens/EvidenceUploadScreen';
import EvidenceTypeScreen from './screens/EvidenceTypeScreen';

import {
  isAuthenticated,
  logout,
  updateActivity,
} from './services/authService';

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useRef(null);

  // Used to know whether a real session was previously active
  const wasAuthenticated = useRef(false);

  // Prevent duplicate logout/alerts
  const loggingOut = useRef(false);

  useEffect(() => {
    const checkSession = () => {
      if (loggingOut.current) {
        return;
      }

      const authenticated = isAuthenticated();

      const currentRoute =
        navigationRef.current?.getCurrentRoute()?.name;

      // User is currently logged in
      if (authenticated) {
        wasAuthenticated.current = true;
        return;
      }

      /*
       * Only show "Session Expired" if:
       * 1. A session was previously active
       * 2. We are not already on Login
       *
       * This prevents the alert from appearing on the login
       * before authentication is completed.
       */
      if (
        wasAuthenticated.current &&
        currentRoute !== 'Login'
      ) {
        wasAuthenticated.current = false;
        loggingOut.current = true;

        logout();

        Alert.alert(
          'Session Expired',
          'You have been automatically logged out after 60 seconds of inactivity.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigationRef.current?.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'Login',
                    },
                  ],
                });

                loggingOut.current = false;
              },
            },
          ],
          {
            cancelable: false,
          }
        );
      }
    };

    // Check immediately
    checkSession();

    // Check every second
    const interval = setInterval(
      checkSession,
      1000
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  /*
   * Any touch anywhere in the application
   * counts as user activity.
   */
  const handleActivity = () => {
    if (loggingOut.current) {
      return;
    }

    if (isAuthenticated()) {
      updateActivity();
    }
  };

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        handleActivity();

        // Return false so the actual button/input
        // can still receive the touch.
        return false;
      }}
    >
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen
            name="Login"
            component={LoginScreen}
          />

          <Stack.Screen
            name="MFA"
            component={MFAScreen}
          />

          <Stack.Screen
            name="Home"
            component={HomeScreen}
          />

          <Stack.Screen
            name="Scanner"
            component={ScannerScreen}
          />

          <Stack.Screen
            name="Result"
            component={ResultScreen}
          />

          <Stack.Screen
            name="CaptureEvidence"
            component={CaptureEvidenceScreen}
          />

          <Stack.Screen
            name="FaceMatchResult"
            component={FaceMatchResultScreen}
          />

          <Stack.Screen
            name="DatabaseSearch"
            component={DatabaseSearchScreen}
          />

          <Stack.Screen
            name="EvidenceUpload"
            component={EvidenceUploadScreen}
          />

          <Stack.Screen
            name="EvidenceType"
            component={EvidenceTypeScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}