import { api } from "./client";

export interface Business {
  id: string;
  name: string;
  slug: string;
  category: string;
  branches: Branch[];
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
}

export interface ProfessionalItem {
  id: string;
  fullName: string;
  specialty: string | null;
  isActive: boolean;
}

export interface AppointmentItem {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  currency: string;
  service: { name: string };
  professional: { fullName: string };
  customer: { fullName: string };
}

export function login(email: string, password: string) {
  return api.post<{
    user: { id: string; email: string | null; role: string };
    accessToken: string;
    refreshToken: string;
  }>("/auth/login", { email, password });
}

export function createBusiness(input: { name: string; slug: string; category: string }) {
  return api.post<Business>("/businesses", input);
}

export function listMyBusinesses() {
  return api.get<Business[]>("/businesses/mine");
}

export function createBranch(businessId: string, input: { name: string; city: string; address: string }) {
  return api.post<Branch>(`/businesses/${businessId}/branches`, input);
}

export function listServices(branchId: string) {
  return api.get<ServiceItem[]>(`/branches/${branchId}/services?all=true`);
}

export function createService(
  branchId: string,
  input: { name: string; durationMin: number; priceCents: number },
) {
  return api.post<ServiceItem>(`/branches/${branchId}/services`, input);
}

export function deactivateService(branchId: string, serviceId: string) {
  return api.delete<void>(`/branches/${branchId}/services/${serviceId}`);
}

export function listProfessionals(branchId: string) {
  return api.get<ProfessionalItem[]>(`/branches/${branchId}/professionals?all=true`);
}

export function createProfessional(branchId: string, input: { fullName: string; specialty?: string }) {
  return api.post<ProfessionalItem>(`/branches/${branchId}/professionals`, input);
}

export function assignProfessionalsToService(branchId: string, serviceId: string, professionalIds: string[]) {
  return api.put(`/branches/${branchId}/services/${serviceId}/professionals`, { professionalIds });
}

export function setProfessionalAvailability(
  branchId: string,
  professionalId: string,
  slots: { weekday: number; startTime: string; endTime: string }[],
) {
  return api.put(`/branches/${branchId}/professionals/${professionalId}/availability`, { slots });
}

export function listBranchAppointments(branchId: string, date?: string) {
  const query = date ? `?date=${date}` : "";
  return api.get<AppointmentItem[]>(`/branches/${branchId}/appointments${query}`);
}

export function transitionAppointment(branchId: string, appointmentId: string, status: string) {
  return api.patch<AppointmentItem>(`/branches/${branchId}/appointments/${appointmentId}/status`, { status });
}

export function formatMoney(cents: number, currency: string) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
