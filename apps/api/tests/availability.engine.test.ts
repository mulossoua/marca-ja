import { describe, expect, it } from "vitest";
import { computeAvailableSlots } from "../src/modules/availability/availability.engine";

// Segunda-feira fixa e no futuro, para os testes não dependerem de "hoje".
const MONDAY = new Date("2099-01-05T00:00:00");

function at(hh: number, mm = 0): Date {
  return new Date(MONDAY.getFullYear(), MONDAY.getMonth(), MONDAY.getDate(), hh, mm);
}

describe("Motor de disponibilidade (unidade, sem BD)", () => {
  it("devolve vazio quando o estabelecimento está fechado", () => {
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 30,
      businessHours: { opensAt: "08:00", closesAt: "18:00", isClosed: true },
      weeklyAvailability: [{ startTime: "08:00", endTime: "18:00" }],
      timeBlocks: [],
      busyAppointments: [],
    });
    expect(slots).toEqual([]);
  });

  it("devolve vazio quando o profissional não tem disponibilidade nesse dia", () => {
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 30,
      businessHours: { opensAt: "08:00", closesAt: "18:00", isClosed: false },
      weeklyAvailability: [],
      timeBlocks: [],
      busyAppointments: [],
    });
    expect(slots).toEqual([]);
  });

  it("gera horários dentro da intersecção entre horário do estabelecimento e do profissional", () => {
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 60,
      businessHours: { opensAt: "09:00", closesAt: "12:00", isClosed: false },
      // profissional só chega às 10:00, mais tarde que o estabelecimento abre
      weeklyAvailability: [{ startTime: "10:00", endTime: "18:00" }],
      timeBlocks: [],
      busyAppointments: [],
      stepMinutes: 60,
    });

    // Janela útil real: 10:00–12:00 (limitada pelo fecho do estabelecimento às 12:00)
    expect(slots).toEqual([at(10, 0), at(11, 0)]);
  });

  it("nunca sugere um horário que colida com uma marcação existente", () => {
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 30,
      businessHours: { opensAt: "09:00", closesAt: "11:00", isClosed: false },
      weeklyAvailability: [{ startTime: "09:00", endTime: "11:00" }],
      timeBlocks: [],
      busyAppointments: [{ start: at(9, 30), end: at(10, 0) }],
      stepMinutes: 30,
    });

    expect(slots).not.toContainEqual(at(9, 30));
    expect(slots).toEqual([at(9, 0), at(10, 0), at(10, 30)]);
  });

  it("nunca sugere um horário que colida com um bloqueio (folga/pausa)", () => {
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 30,
      businessHours: { opensAt: "09:00", closesAt: "13:00", isClosed: false },
      weeklyAvailability: [{ startTime: "09:00", endTime: "13:00" }],
      // pausa de almoço
      timeBlocks: [{ start: at(12, 0), end: at(13, 0) }],
      busyAppointments: [],
      stepMinutes: 30,
    });

    expect(slots).not.toContainEqual(at(12, 0));
    expect(slots).not.toContainEqual(at(12, 30));
    expect(slots[slots.length - 1]).toEqual(at(11, 30));
  });

  it("não gera um horário cujo serviço ultrapasse o fecho do estabelecimento", () => {
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 60,
      businessHours: { opensAt: "09:00", closesAt: "10:30", isClosed: false },
      weeklyAvailability: [{ startTime: "09:00", endTime: "10:30" }],
      timeBlocks: [],
      busyAppointments: [],
      stepMinutes: 30,
    });

    // Só 09:00 cabe (09:00-10:00); 09:30 terminaria às 10:30... na fronteira exacta é permitido.
    expect(slots).toEqual([at(9, 0), at(9, 30)]);
  });

  it("uma marcação que começa exactamente onde outra termina não gera conflito falso", () => {
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 30,
      businessHours: { opensAt: "09:00", closesAt: "11:00", isClosed: false },
      weeklyAvailability: [{ startTime: "09:00", endTime: "11:00" }],
      timeBlocks: [],
      busyAppointments: [{ start: at(9, 30), end: at(10, 0) }],
      stepMinutes: 30,
    });

    // 10:00 deve estar livre (a marcação anterior terminou exactamente às 10:00)
    expect(slots).toContainEqual(at(10, 0));
  });

  it("respeita múltiplos blocos de disponibilidade do profissional no mesmo dia", () => {
    const slots = computeAvailableSlots({
      date: MONDAY,
      durationMin: 30,
      businessHours: { opensAt: "08:00", closesAt: "18:00", isClosed: false },
      // manhã e tarde, com intervalo de almoço embutido na própria disponibilidade
      weeklyAvailability: [
        { startTime: "08:00", endTime: "12:00" },
        { startTime: "14:00", endTime: "18:00" },
      ],
      timeBlocks: [],
      busyAppointments: [],
      stepMinutes: 60,
    });

    expect(slots).not.toContainEqual(at(12, 30));
    expect(slots).not.toContainEqual(at(13, 0));
    expect(slots).toContainEqual(at(11, 0));
    expect(slots).toContainEqual(at(14, 0));
  });
});
