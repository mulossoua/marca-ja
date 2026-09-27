import React, { useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getBranchProfessionals, getBranchServices, formatMoney, type ServiceItem } from "../api/booking";
import { ApiError } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "BusinessDetail">;

export default function BusinessDetailScreen({ route, navigation }: Props) {
  const { branchId, businessName } = route.params;
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [professionalCount, setProfessionalCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getBranchServices(branchId), getBranchProfessionals(branchId)])
      .then(([serviceList, professionals]) => {
        setServices(serviceList);
        setProfessionalCount(professionals.length);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Não foi possível carregar o estabelecimento."))
      .finally(() => setLoading(false));
  }, [branchId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{businessName}</Text>
        {professionalCount !== null && (
          <Text style={styles.subtitle}>
            {professionalCount} profissional{professionalCount === 1 ? "" : "is"} disponíve
            {professionalCount === 1 ? "l" : "is"}
          </Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Serviços</Text>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : !loading && services.length === 0 ? (
        <Text style={styles.emptyText}>Este estabelecimento ainda não tem serviços disponíveis.</Text>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.serviceCard}
              onPress={() => navigation.navigate("Booking", { branchId, businessName, serviceId: item.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{item.name}</Text>
                <Text style={styles.serviceMeta}>{item.durationMin} min</Text>
              </View>
              <Text style={styles.servicePrice}>{formatMoney(item.priceCents, item.currency)}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate("Booking", { branchId, businessName })}
      >
        <Text style={styles.primaryButtonText}>Marcar agora</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F", padding: 20 },
  header: { marginBottom: 24 },
  back: { color: "#A0A0AB", marginBottom: 16 },
  title: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#A0A0AB", marginTop: 4 },
  sectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  error: { color: "#FF6B6B" },
  emptyText: { color: "#A0A0AB" },
  serviceCard: {
    backgroundColor: "#18181F",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  serviceName: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  serviceMeta: { color: "#A0A0AB", marginTop: 2, fontSize: 13 },
  servicePrice: { color: "#FFFFFF", fontWeight: "700" },
  primaryButton: { backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  primaryButtonText: { color: "#0B0B0F", fontWeight: "700", fontSize: 16 },
});
