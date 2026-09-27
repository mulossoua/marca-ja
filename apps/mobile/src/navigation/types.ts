import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Explore: undefined;
  MyAppointments: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  BusinessDetail: { branchId: string; businessName: string };
  Booking: { branchId: string; businessName: string; serviceId?: string };
  AppointmentDetail: { appointmentId: string };
};
