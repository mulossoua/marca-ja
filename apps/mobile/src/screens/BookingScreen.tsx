import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import {
  createAppointment,
  formatMoney,
  getAvailability,
  getBranchProfessionals,
  getBranchServices,
  type ProfessionalItem,
  type ProfessionalSlots,
  type ServiceItem,
} from "../api/booking";
import { ApiError } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "Booking">;

const ANY_PROFESSIONAL = "__any__";

function nextDays(count: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function BookingScreen({ route, navigation }: Props) {
  const { branchId, businessName, serviceId: preselectedServiceId } = route.params;

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [serviceId, setServiceId] = useState<string | undefined>(preselectedServiceId);
  const [professionalId, setProfessionalId] = useState<string>(ANY_PROFESSIONAL);
  const [selectedDate, setSelectedDate] = useState<Date>(nextDays(1)[0]);

  const [availability, setAvailability] = useState<ProfessionalSlots[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<{ professionalId: string; iso: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const days = useMemo(() => nextDays(14), []);
  const selectedService = services.find((s) => s.id === serviceId);

  useEffect(() => {
    Promise.all([getBranchServices(branchId), getBranchProfessionals(branchId)])
      .then(([serviceList, professionalList]) => {
        setServices(serviceList);
        setProfessionals(professionalList);
      })
      .catch((err) =>
        setCatalogError(err instanceof ApiError ? err.message : "Não foi possível carregar os dados do estabelecimento."),
      )
      .finally(() => setLoadingCatalog(false));
  }, [branchId]);

  useEffect(() => {
    if (!serviceId) return;
    setSelectedSlot(null);
    setLoadingSlots(true);
    setSlotsError(null);

    getAvailability(branchId, {
      serviceId,
      date: toDateKey(selectedDate),
      professionalId: professionalId === ANY_PROFESSIONAL ? undefined : professionalId,
    })
      .then(setAvailability)
      .catch((err) =>
        setSlotsError(err instanceof ApiError ? err.message : "Não conseguimos carregar os horários disponíveis."),
      )
      .finally(() => setLoadingSlots(false));
  }, [branchId, serviceId, professionalId, selectedDate]);

  async function handleConfirm() {
    if (!serviceId || !selectedSlot) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      await createAppointment(branchId, {
        serviceId,
        professionalId: selectedSlot.professionalId,
        startsAt: selectedSlot.iso,
      });
      setConfirmed(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Regra 42: outro cliente pode ter reservado este horário entretanto.
        setConfirmError("Este horário acabou de ser reservado por outro cliente. Escolha outro horário.");
        setSelectedSlot(null);
        // Recarregar disponibilidade para reflectir o estado real.
        getAvailability(branchId, {
          serviceId,
          date: toDateKey(selectedDate),
          professionalId: professionalId === ANY_PROFESSIONAL ? undefined : professionalId,
        }).then(setAvailability);
      } else {
        setConfirmError(err instanceof ApiError ? err.message : "Não foi possível concluir a marcação.");
      }
    } finally {
      setConfirming(false);
    }
  }

  if (confirmed) {
    return (
      <View style={styles.confirmedContainer}>
        <Text style={styles.confirmedTitle}>Marcação confirmada</Text>
        <Text style={styles.confirmedBody}>
          A sua marcação em {businessName} foi registada. Vai receber uma notificação de confirmação.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("Main", { screen: "MyAppointments" })}
        >
          <Text style={styles.primaryButtonText}>Ver as minhas marcações</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loadingCatalog) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{businessName}</Text>

      {catalogError && <Text style={styles.error}>{catalogError}</Text>}

      <Text style={styles.sectionTitle}>1. Serviço</Text>
      <View style={styles.chipsWrap}>
        {services.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.chip, serviceId === s.id && styles.chipActive]}
            onPress={() => setServiceId(s.id)}
          >
            <Text style={[styles.chipText, serviceId === s.id && styles.chipTextActive]}>
              {s.name} · {formatMoney(s.priceCents, s.currency)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {serviceId && (
        <>
          <Text style={styles.sectionTitle}>2. Profissional</Text>
          <View style={styles.chipsWrap}>
            <TouchableOpacity
              style={[styles.chip, professionalId === ANY_PROFESSIONAL && styles.chipActive]}
              onPress={() => setProfessionalId(ANY_PROFESSIONAL)}
            >
              <Text style={[styles.chipText, professionalId === ANY_PROFESSIONAL && styles.chipTextActive]}>
                Qualquer profissional
              </Text>
            </TouchableOpacity>
            {professionals
              .filter((p) => p.services.some((ps) => ps.service.id === serviceId))
              .map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.chip, professionalId === p.id && styles.chipActive]}
                  onPress={() => setProfessionalId(p.id)}
                >
                  <Text style={[styles.chipText, professionalId === p.id && styles.chipTextActive]}>
                    {p.fullName}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>

          <Text style={styles.sectionTitle}>3. Data</Text>
          <FlatList
            horizontal
            data={days}
            keyExtractor={(d) => toDateKey(d)}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const active = toDateKey(item) === toDateKey(selectedDate);
              return (
                <TouchableOpacity
                  style={[styles.dayCard, active && styles.dayCardActive]}
                  onPress={() => setSelectedDate(item)}
                >
                  <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>
                    {WEEKDAY_LABELS[item.getDay()]}
                  </Text>
                  <Text style={[styles.dayNumber, active && styles.dayLabelActive]}>{item.getDate()}</Text>
                </TouchableOpacity>
              );
            }}
          />

          <Text style={styles.sectionTitle}>4. Horário</Text>
          {loadingSlots ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginTop: 12 }} />
          ) : slotsError ? (
            <Text style={styles.error}>{slotsError}</Text>
          ) : availability.every((p) => p.slots.length === 0) || availability.length === 0 ? (
            <Text style={styles.emptyText}>Sem horários disponíveis neste dia. Experimente outra data.</Text>
          ) : (
            availability.map((p) => (
              <View key={p.professionalId} style={{ marginBottom: 12 }}>
                {professionalId === ANY_PROFESSIONAL && <Text style={styles.professionalLabel}>{p.professionalName}</Text>}
                <View style={styles.chipsWrap}>
                  {p.slots.map((iso) => {
                    const active = selectedSlot?.iso === iso && selectedSlot.professionalId === p.professionalId;
                    return (
                      <TouchableOpacity
                        key={iso}
                        style={[styles.slotChip, active && styles.chipActive]}
                        onPress={() => setSelectedSlot({ professionalId: p.professionalId, iso })}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          {selectedSlot && selectedService && (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Resumo</Text>
              <Text style={styles.summaryLine}>{businessName}</Text>
              <Text style={styles.summaryLine}>{selectedService.name}</Text>
              <Text style={styles.summaryLine}>
                {new Date(selectedSlot.iso).toLocaleString("pt-PT", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              <Text style={styles.summaryLine}>{formatMoney(selectedService.priceCents, selectedService.currency)}</Text>

              {confirmError && <Text style={styles.error}>{confirmError}</Text>}

              <TouchableOpacity style={styles.primaryButton} onPress={handleConfirm} disabled={confirming}>
                {confirming ? <ActivityIndicator color="#0B0B0F" /> : <Text style={styles.primaryButtonText}>Confirmar marcação</Text>}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F", padding: 20 },
  loadingContainer: { flex: 1, backgroundColor: "#0B0B0F", alignItems: "center", justifyContent: "center" },
  back: { color: "#A0A0AB", marginBottom: 12 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "700", marginBottom: 20 },
  sectionTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "600", marginTop: 20, marginBottom: 10 },
  error: { color: "#FF6B6B", marginTop: 8 },
  emptyText: { color: "#A0A0AB" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3A3A45",
    marginBottom: 8,
  },
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3A3A45",
    marginBottom: 8,
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  chipText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#0B0B0F" },
  professionalLabel: { color: "#A0A0AB", marginBottom: 6, fontSize: 13 },
  dayCard: {
    width: 56,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3A3A45",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  dayCardActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  dayLabel: { color: "#A0A0AB", fontSize: 12 },
  dayNumber: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginTop: 2 },
  dayLabelActive: { color: "#0B0B0F" },
  summary: { backgroundColor: "#18181F", borderRadius: 16, padding: 16, marginTop: 24 },
  summaryTitle: { color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginBottom: 8 },
  summaryLine: { color: "#A0A0AB", marginBottom: 4 },
  primaryButton: { backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  primaryButtonText: { color: "#0B0B0F", fontWeight: "700", fontSize: 16 },
  confirmedContainer: { flex: 1, backgroundColor: "#0B0B0F", padding: 24, justifyContent: "center" },
  confirmedTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  confirmedBody: { color: "#A0A0AB", textAlign: "center", marginBottom: 24 },
});
