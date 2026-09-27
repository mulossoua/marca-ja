import AsyncStorage from "@react-native-async-storage/async-storage";

// Aponte para o IP da máquina que corre a API ao testar em dispositivo físico/emulador.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

const ACCESS_TOKEN_KEY = "auth.accessToken";
const REFRESH_TOKEN_KEY = "auth.refreshToken";

// Erro tipado para o chamador poder distinguir, por exemplo, um 409 de conflito de
// horário (regra 42) de um erro genérico — a UI trata cada caso de forma diferente.
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    // Nunca mostrar o erro técnico de rede ao utilizador (regra 55).
    throw new ApiError("Verifique a sua ligação à internet e tente novamente.", 0, "NETWORK_ERROR");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      body?.error?.message ?? "Não conseguimos concluir a operação neste momento. Tente novamente.",
      res.status,
      body?.error?.code,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
};

export async function saveSession(accessToken: string, refreshToken: string) {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearSession() {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

export async function getStoredAccessToken() {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}
