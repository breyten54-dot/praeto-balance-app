import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../context/appStore';
import { colors } from '../theme/colors';
import DashboardScreen from '../screens/DashboardScreen';
import GamblingMonitorScreen from '../screens/GamblingMonitorScreen';
import LearnScreen from '../screens/LearnScreen';
import SaveScreen from '../screens/SaveScreen';
import RewardsScreen from '../screens/RewardsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RiskProfileScreen from '../screens/RiskProfileScreen';
import PaywallScreen from '../screens/PaywallScreen';
import CoachingBookingScreen from '../screens/CoachingBookingScreen';
import LoginScreen from '../screens/LoginScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home',
  Gambling: 'pulse',
  Learn: 'book',
  Save: 'wallet',
  Rewards: 'star',
  Profile: 'person-circle',
};

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarStyle: { backgroundColor: colors.navy, borderTopWidth: 0 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name] ?? 'ellipse'} color={color} size={size - 2} />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Gambling" component={GamblingMonitorScreen} options={{ title: 'Gambling' }} />
      <Tab.Screen name="Learn" component={LearnScreen} />
      <Tab.Screen name="Save" component={SaveScreen} />
      <Tab.Screen name="Rewards" component={RewardsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="RiskProfile"
              component={RiskProfileScreen}
              options={{ presentation: 'modal', headerShown: true, title: 'Know Your Risk' }}
            />
            <Stack.Screen name="Paywall" component={PaywallScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen
              name="CoachingBooking"
              component={CoachingBookingScreen}
              options={{ presentation: 'modal', headerShown: true, title: 'Book a session' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
