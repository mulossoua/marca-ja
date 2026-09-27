import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { cancelAppointment, formatMoney, listMyAppointments, type Appointment } from "../api/booking";
import { ApiError } from "../api/client";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  RESCHEDULED: "Reagendada",
  CHECKED_IN: "Check-in feito",
  IN_PROGRESS: "Em curso",
  COMPLETED: "Concluída",
  NO_SHOW: "Falta",
};

function splitAppointments(list: Appointment[]) {
  const now = Date.now();
  const upcoming: Appointment[] = [];
  const past: Appointment[] = [];
  for (const a of list) {
    const isActive = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(a.status);
    if (isActive && new Date(a.startsAt).getTime() >= now) upcoming.push(a);
    else past.push(a);
  }
  return { upcoming, past };
}

export default function MyAppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAppointments(await listMyAppointments());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não conseguimos carregar as suas marcações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmCancel(appointment: Appointment) {
    Alert.alert("Cancelar marcação", "Tem a certeza que quer cancelar esta marcação?", [
      { text: "Voltar", style: "cancel" },
      {
        text: "Cancelar marcação",
        style: "destructive",
        onPress: async () => {
          setCancellingId(appointment.id);
          try {
            await cancelAppointment(appointment.id);
            await load();
          } catch (err) {
            Alert.alert("Não foi possível cancelar", err instanceof ApiError ? err.message : "Tente novamente.");
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  }

  const { upcoming, past } = splitAppointments(appointments);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>As minhas marcações</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {appointments.length === 0 && !error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Ainda não tem marcações.</Text>
          <Text style={styles.emptyHint}>Explore estabelecimentos e marque o seu próximo serviço.</Text>
        </View>
      ) : (
        <FlatList
          data={[...upcoming, ...past]}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#FFFFFF" />}
          ListHeaderComponent={upcoming.length > 0 ? <Text style={styles.sectionTitle}>Próximas</Text> : null}
          renderItem={({ item, index }) => (
            <>
              {index === upcoming.length && past.length > 0 && <Text style={styles.sectionTitle}>Histórico</Text>}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardBusiness}>{item.branch?.business.name ?? "Estabelecimento"}</Text>
                  <Text style={styles.cardStatus}>{STATUS_LABELS[item.status] ?? item.status}</Text>
                </View>
                <Text style={styles.cardService}>{item.service?.name}</Text>
                <Text style={styles.cardMeta}>
                  {new Date(item.startsAt).toLocaleString("pt-PT", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {item.professional ? ` · ${item.professional.fullName}` : ""}
                </Text>
                {item.service && <Text style={styles.cardPrice}>{formatMoney(item.priceCents, item.currency)}</Text>}

                {["PENDING", "CONFIRMED"].includes(item.status) && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => confirmCancel(item)}
                    disabled={cancellingId === item.id}
                  >
                    {cancellingId === item.id ? (
                      <ActivityIndicator color="#FF6B6B" />
                    ) : (
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F", padding: 20 },
  loadingContainer: { flex: 1, backgroundColor: "#0B0B0F", alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "700", marginBottom: 16 },
  error: { color: "#FF6B6B", marginBottom: 12 },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  emptyHint: { color: "#A0A0AB", marginTop: 6, textAlign: "center" },
  sectionTitle: { color: "#A0A0AB", fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 8, textTransform: "uppercase" },
  card: { backgroundColor: "#18181F", borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardBusiness: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  cardStatus: { color: "#A0A0AB", fontSize: 12 },
  cardService: { color: "#FFFFFF", marginTop: 6 },
  cardMeta: { color: "#A0A0AB", marginTop: 4, fontSize: 13 },
  cardPrice: { color: "#FFFFFF", fontWeight: "700", marginTop: 8 },
  cancelButton: { marginTop: 12, alignSelf: "flex-start" },
  cancelButtonText: { color: "#FF6B6B", fontWeight: "600" },
});
