import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatRoomScreen from './src/screens/ChatRoomScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { initDatabase } from './src/utils/database';
import { useEffect } from 'react';
import BLEMeshService from './src/services/BLEMeshService';
import P2PService from './src/services/P2PService';

const Stack = createNativeStackNavigator();

// WhatsApp-like Dark Theme Colors
const WhatsAppDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#128C7E', // WhatsApp Green
    background: '#111b21', // WhatsApp Dark Background
    card: '#202c33', // WhatsApp Dark Card
    text: '#e9edef',
    border: '#2a3942',
    notification: '#00a884',
  },
};

function Navigation() {
  const { user, loading } = useAuth();

  console.log('Navigation State - Loading:', loading, 'User:', !!user);

  if (loading) {
    console.log('Rendering Loading Screen');
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#00a884" />
      </View>
    );
  }

  console.log('Rendering Navigator - Authenticated:', !!user);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#202c33' },
        headerTintColor: '#e9edef',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: 'Private Messaging' }} />
          <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Contact Info' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    initDatabase();

    // Set notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  const { user } = useAuth();
  useEffect(() => {
    if (user) {
      BLEMeshService.initialize(user.id, user.publicKey);
    }
  }, [user]);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={WhatsAppDarkTheme}>
          <StatusBar style="light" />
          <Navigation />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111b21'
  }
});
