import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import type { MainTabParamList } from "./types";
import ExploreScreen from "../screens/ExploreScreen";
import MyAppointmentsScreen from "../screens/MyAppointmentsScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();

// Navegação principal do cliente: Explorar | Marcações | Perfil (regra 38).
export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#0B0B0F", borderTopColor: "#18181F" },
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#6B6B76",
      }}
    >
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{ title: "Explorar", tabBarIcon: ({ color }) => <Text style={{ color }}>🔍</Text> }}
      />
      <Tab.Screen
        name="MyAppointments"
        component={MyAppointmentsScreen}
        options={{ title: "Marcações", tabBarIcon: ({ color }) => <Text style={{ color }}>📅</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Perfil", tabBarIcon: ({ color }) => <Text style={{ color }}>👤</Text> }}
      />
    </Tab.Navigator>
  );
}
