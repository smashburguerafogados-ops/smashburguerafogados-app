import { describe, expect, it } from 'vitest'
import { countsAsRevenue, periodStart, revenueTotal, type RevenueEntry } from './lib/revenue'

const now = new Date(2026, 10, 18, 15, 0, 0)

function entry(totalCents: number, at: Date): RevenueEntry {
  return { orderId: String(at.getTime()), totalCents, finalizedAtMs: at.getTime() }
}

describe('faturamento', () => {
  it('counts only a move out of em andamento', () => {
    expect(countsAsRevenue('andamento')).toBe(true)
    expect(countsAsRevenue('enviado')).toBe(true)
    expect(countsAsRevenue('novo')).toBe(false)
    expect(countsAsRevenue('recusado')).toBe(false)
    expect(countsAsRevenue('cancelado')).toBe(false)
    expect(countsAsRevenue('finalizado')).toBe(false)
  })

  it('splits the stored amounts by the selected window', () => {
    const entries = [
      entry(5600, new Date(2026, 10, 18, 9, 0, 0)),
      entry(1000, new Date(2026, 9, 9, 9, 0, 0)),
    ]
    expect(revenueTotal(entries, 'dia', now)).toBe(5600)
    expect(revenueTotal(entries, 'semana', now)).toBe(5600)
    expect(revenueTotal(entries, 'quinzena', now)).toBe(5600)
    expect(revenueTotal(entries, 'mensal', now)).toBe(5600)
    expect(revenueTotal(entries, 'total', now)).toBe(6600)
    expect(revenueTotal(entries, 'geral', now)).toBe(6600)
    expect(periodStart('semana', now)).toBe(new Date(2026, 10, 16).getTime())
    expect(periodStart('quinzena', now)).toBe(new Date(2026, 10, 16).getTime())
    expect(periodStart('mensal', now)).toBe(new Date(2026, 10, 1).getTime())
  })
})
