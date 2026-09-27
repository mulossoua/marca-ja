import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 15000,
    // Os ficheiros partilham uma única base Postgres real. Transacções SERIALIZABLE
    // não relacionadas (motor de reserva de marcações) podem colidir por bloqueio de
    // predicados quando correm em paralelo, produzindo falsos 409 — não é um bug de
    // lógica, é uma característica do SSI do Postgres sob concorrência. Corre-se a
    // suite sequencialmente para eliminar esse ruído.
    fileParallelism: false,
  },
});
