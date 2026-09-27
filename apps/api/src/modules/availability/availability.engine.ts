// Motor de disponibilidade puro (regra 15): recebe os dados já carregados da BD e
// devolve os intervalos livres. Sem I/O aqui — torna-o trivial de testar
// exaustivamente, incluindo casos de fronteira que decidem se uma marcação é possível.

export interface Interval {
  start: Date;
  end: Date;
}

export interface AvailabilityInput {
  date: Date; // qualquer instante nesse dia, em UTC "naive" (ver availability.service.ts)
  durationMin: number;
  businessHours: { opensAt: string; closesAt: string; isClosed: boolean } | null;
  weeklyAvailability: { startTime: string; endTime: string }[];
  timeBlocks: Interval[];
  busyAppointments: Interval[];
  stepMinutes?: number;
}

function timeStringToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function minutesToDate(day: Date, minutes: number): Date {
  return new Date(day.getTime() + minutes * 60 * 1000);
}

// Interseca uma lista de intervalos "livres" com um único intervalo de corte.
function intersectWithWindow(windows: Interval[], window: Interval): Interval[] {
  return windows
    .map((w) => ({ start: w.start < window.start ? window.start : w.start, end: w.end > window.end ? window.end : w.end }))
    .filter((w) => w.start < w.end);
}

// Subtrai uma lista de intervalos ocupados de uma lista de intervalos livres.
function subtractBusy(free: Interval[], busy: Interval[]): Interval[] {
  let result = free;
  for (const b of busy) {
    const next: Interval[] = [];
    for (const w of result) {
      if (b.end <= w.start || b.start >= w.end) {
        // sem sobreposição
        next.push(w);
        continue;
      }
      if (b.start > w.start) next.push({ start: w.start, end: b.start });
      if (b.end < w.end) next.push({ start: b.end, end: w.end });
    }
    result = next.filter((w) => w.start < w.end);
  }
  return result;
}

// Gera horários de início possíveis dentro dos intervalos livres, respeitando a
// duração do serviço e o passo de grelha (ex.: de 15 em 15 minutos).
function generateSlotStarts(freeWindows: Interval[], durationMin: number, stepMinutes: number): Date[] {
  const durationMs = durationMin * 60 * 1000;
  const stepMs = stepMinutes * 60 * 1000;
  const starts: Date[] = [];

  for (const w of freeWindows) {
    let cursor = w.start.getTime();
    const limit = w.end.getTime() - durationMs;
    while (cursor <= limit) {
      starts.push(new Date(cursor));
      cursor += stepMs;
    }
  }
  return starts;
}

// Calcula os horários de início disponíveis para UM profissional num dia.
// Nunca devolve um horário que colida com bloqueios ou marcações existentes
// (regra 15 e 42: a verificação definitiva de conflito é sempre feita aqui e
// reconfirmada em transacção no momento da escrita — nunca só no frontend).
export function computeAvailableSlots(input: AvailabilityInput): Date[] {
  if (!input.businessHours || input.businessHours.isClosed) return [];
  if (input.weeklyAvailability.length === 0) return [];

  const day = startOfDay(input.date);
  const stepMinutes = input.stepMinutes ?? 15;

  const businessWindow: Interval = {
    start: minutesToDate(day, timeStringToMinutes(input.businessHours.opensAt)),
    end: minutesToDate(day, timeStringToMinutes(input.businessHours.closesAt)),
  };

  const professionalWindows: Interval[] = input.weeklyAvailability.map((slot) => ({
    start: minutesToDate(day, timeStringToMinutes(slot.startTime)),
    end: minutesToDate(day, timeStringToMinutes(slot.endTime)),
  }));

  let freeWindows = intersectWithWindow(professionalWindows, businessWindow);
  freeWindows = subtractBusy(freeWindows, input.timeBlocks);
  freeWindows = subtractBusy(freeWindows, input.busyAppointments);

  // Nunca sugerir um horário no passado.
  const now = new Date();
  freeWindows = freeWindows
    .map((w) => ({ start: w.start < now ? now : w.start, end: w.end }))
    .filter((w) => w.start < w.end);

  return generateSlotStarts(freeWindows, input.durationMin, stepMinutes);
}
