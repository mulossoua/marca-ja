import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

const STEPS = [
  { title: "Encontre", body: "Encontre salões e barbearias perto de si." },
  { title: "Escolha", body: "Escolha serviço e profissional." },
  { title: "Marque", body: "Escolha data e horário em segundos." },
  { title: "Aproveite", body: "Receba confirmação e lembretes." },
];

export default function OnboardingScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Marca Já</Text>

      {STEPS.map((step) => (
        <View key={step.title} style={styles.step}>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepBody}>{step.body}</Text>
        </View>
      ))}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.replace("Register")}>
          <Text style={styles.primaryButtonText}>Criar conta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace("Login")}>
          <Text style={styles.secondaryButtonText}>Entrar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.replace("Main", { screen: "Explore" })}>
          <Text style={styles.exploreLink}>Explorar sem criar conta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#0B0B0F" },
  brand: { fontSize: 32, fontWeight: "700", color: "#FFFFFF", marginBottom: 32, textAlign: "center" },
  step: { marginBottom: 16 },
  stepTitle: { fontSize: 18, fontWeight: "600", color: "#FFFFFF" },
  stepBody: { fontSize: 14, color: "#A0A0AB", marginTop: 2 },
  actions: { marginTop: 32, gap: 12 },
  primaryButton: { backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: "#0B0B0F", fontWeight: "700", fontSize: 16 },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3A3A45",
  },
  secondaryButtonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 16 },
  exploreLink: { color: "#A0A0AB", textAlign: "center", marginTop: 8, textDecorationLine: "underline" },
});
