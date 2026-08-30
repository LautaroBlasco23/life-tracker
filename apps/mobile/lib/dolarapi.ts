export interface DolarRate {
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

/** Public Argentine dollar rates (dolarapi.com). Degrades to null on failure. */
export async function fetchDolarRates(): Promise<{ oficial: DolarRate | null; blue: DolarRate | null }> {
  const res = await fetch('https://dolarapi.com/v1/dolares');
  if (!res.ok) throw new Error('Failed to load dolar rates');
  const data: DolarRate[] = await res.json();
  return {
    oficial: data.find((r) => r.casa === 'oficial') ?? null,
    blue: data.find((r) => r.casa === 'blue') ?? null,
  };
}
