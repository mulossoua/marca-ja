import { api } from "./client";

export interface BranchSearchResult {
  id: string;
  name: string;
  city: string;
  address: string;
  business: { id: string; name: string; category: string; logoUrl: string | null; coverUrl: string | null };
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  currency: string;
  category: { id: string; name: string } | null;
}

export interface ProfessionalItem {
  id: string;
  fullName: string;
  specialty: string | null;
  avatarUrl: string | null;
  services: { service: ServiceItem }[];
}

export interface ProfessionalSlots {
  professionalId: string;
  professionalName: string;
  slots: string[];
}

export interface Appointment {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  currency: string;
  service?: ServiceItem;
  professional?: { id: string; fullName: string };
  branch?: { name: string; city: string; business: { name: string } };
}

export function searchBranches(params: { q?: string; city?: string; category?: string }) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => !!v) as [string, string][],
  ).toString();
  return api.get<BranchSearchResult[]>(`/businesses/search${query ? `?${query}` : ""}`);
}

export function getBranchServices(branchId: string) {
  return api.get<ServiceItem[]>(`/branches/${branchId}/services/public`);
}

export function getBranchProfessionals(branchId: string) {
  return api.get<ProfessionalItem[]>(`/branches/${branchId}/professionals/public`);
}

export function getAvailability(
  branchId: string,
  params: { serviceId: string; date: string; professionalId?: string },
) {
  // Nunca passar campos undefined directamente a URLSearchParams: seria serializado
  // como a string literal "undefined" e falharia a validação UUID no backend.
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
  ).toString();
  return api.get<ProfessionalSlots[]>(`/branches/${branchId}/availability?${query}`);
}

export function createAppointment(
  branchId: string,
  input: { serviceId: string; professionalId: string; startsAt: string; notes?: string },
) {
  return api.post<Appointment>(`/branches/${branchId}/appointments`, input);
}

export function listMyAppointments() {
  return api.get<Appointment[]>("/appointments/mine");
}

export function cancelAppointment(appointmentId: string, reason?: string) {
  return api.post<Appointment>(`/appointments/${appointmentId}/cancel`, { reason });
}

export function rescheduleAppointment(appointmentId: string, startsAt: string) {
  return api.post<Appointment>(`/appointments/${appointmentId}/reschedule`, { startsAt });
}

export function formatMoney(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}
