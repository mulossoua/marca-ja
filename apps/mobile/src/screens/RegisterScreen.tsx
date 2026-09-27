import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await register(fullName.trim(), email.trim(), password);
      navigation.replace("Main", { screen: "Explore" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Criar conta</Text>

      <TextInput
        style={styles.input}
        placeholder="Nome completo"
        placeholderTextColor="#6B6B76"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6B6B76"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Palavra-passe (mín. 8 caracteres)"
        placeholderTextColor="#6B6B76"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#0B0B0F" /> : <Text style={styles.buttonText}>Criar conta</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.replace("Login")}>
        <Text style={styles.link}>Já tem conta? Entrar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: "#0B0B0F" },
  title: { fontSize: 26, fontWeight: "700", color: "#FFFFFF", marginBottom: 24 },
  input: {
    backgroundColor: "#18181F",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#FFFFFF",
    marginBottom: 12,
  },
  error: { color: "#FF6B6B", marginBottom: 12 },
  button: { backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#0B0B0F", fontWeight: "700", fontSize: 16 },
  link: { color: "#A0A0AB", textAlign: "center", marginTop: 16 },
});
