import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/context/AuthContext";
import type { RootStackParamList } from "./src/navigation/types";
import MainTabNavigator from "./src/navigation/MainTabNavigator";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import BusinessDetailScreen from "./src/screens/BusinessDetailScreen";
import BookingScreen from "./src/screens/BookingScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator initialRouteName="Onboarding" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen name="BusinessDetail" component={BusinessDetailScreen} />
          <Stack.Screen name="Booking" component={BookingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
