import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";
import { searchBranches, type BranchSearchResult } from "../api/booking";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Explore">,
  NativeStackScreenProps<RootStackParamList>
>;

const CATEGORY_FILTERS = [
  { label: "Todos", value: undefined },
  { label: "Barbearias", value: "BARBERSHOP" },
  { label: "Salões", value: "BEAUTY_SALON" },
];

export default function ExploreScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [results, setResults] = useState<BranchSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchBranches({ q: query || undefined, category });
      setResults(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não conseguimos carregar os estabelecimentos.");
    } finally {
      setLoading(false);
    }
  }, [query, category]);

  useEffect(() => {
    load();
  }, [category]);

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{user ? "Encontre o seu próximo agendamento" : "Explorar"}</Text>

      <TextInput
        style={styles.search}
        placeholder="Barbearia, salão, serviço..."
        placeholderTextColor="#6B6B76"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={load}
        returnKeyType="search"
      />

      <View style={styles.filters}>
        {CATEGORY_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.label}
            style={[styles.filterChip, category === f.value && styles.filterChipActive]}
            onPress={() => setCategory(f.value)}
          >
            <Text style={[styles.filterChipText, category === f.value && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : !loading && results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Não encontrámos estabelecimentos para esta pesquisa.</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#FFFFFF" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate("BusinessDetail", { branchId: item.id, businessName: item.business.name })
              }
            >
              <Text style={styles.cardTitle}>{item.business.name}</Text>
              <Text style={styles.cardSubtitle}>
                {item.name} · {item.city}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardCategory}>
                  {item.business.category === "BARBERSHOP" ? "Barbearia" : "Salão de Beleza"}
                </Text>
                <Text style={styles.cardCta}>Ver →</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F", padding: 20 },
  greeting: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginBottom: 16 },
  search: {
    backgroundColor: "#18181F",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#FFFFFF",
    marginBottom: 12,
  },
  filters: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#3A3A45",
  },
  filterChipActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  filterChipText: { color: "#A0A0AB", fontSize: 13, fontWeight: "600" },
  filterChipTextActive: { color: "#0B0B0F" },
  error: { color: "#FF6B6B" },
  empty: { alignItems: "center", marginTop: 40 },
  emptyText: { color: "#A0A0AB", textAlign: "center" },
  card: { backgroundColor: "#18181F", borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  cardSubtitle: { color: "#A0A0AB", marginTop: 4 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, alignItems: "center" },
  cardCategory: {
    color: "#A0A0AB",
    fontSize: 12,
    backgroundColor: "#0B0B0F",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardCta: { color: "#FFFFFF", fontWeight: "700" },
});
