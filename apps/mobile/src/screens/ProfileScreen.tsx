import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Profile">,
  NativeStackScreenProps<RootStackParamList>
>;

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: "Onboarding" }] });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil</Text>

      {user ? (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>Contacto</Text>
            <Text style={styles.value}>{user.email ?? user.phone}</Text>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.primaryButtonText}>Entrar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F", padding: 20 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "700", marginBottom: 20 },
  card: { backgroundColor: "#18181F", borderRadius: 14, padding: 16, marginBottom: 20 },
  label: { color: "#A0A0AB", fontSize: 12 },
  value: { color: "#FFFFFF", fontSize: 15, marginTop: 4 },
  logoutButton: { alignSelf: "flex-start" },
  logoutText: { color: "#FF6B6B", fontWeight: "600" },
  primaryButton: { backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: "#0B0B0F", fontWeight: "700", fontSize: 16 },
});
