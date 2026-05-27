import type { ChartDataPoint } from '../types';

function generatePriceData(
  basePrice: number,
  points: number,
  volatility: number,
  trend: number = 0
): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  let price = basePrice;
  const now = Date.now();

  for (let i = points; i >= 0; i--) {
    const time = new Date(now - i * 3600 * 1000);
    const change = (Math.random() - 0.48 + trend) * volatility;
    price = Math.max(price * (1 + change), basePrice * 0.7);
    data.push({
      time: time.toISOString(),
      value: parseFloat(price.toFixed(2)),
    });
  }
  return data;
}

export const chartDataMap: Record<string, ChartDataPoint[]> = {
  btc: generatePriceData(65000, 48, 0.02, 0.003),
  eth: generatePriceData(3700, 48, 0.025, -0.001),
  sol: generatePriceData(160, 48, 0.04, 0.008),
  aapl: generatePriceData(205, 48, 0.008, 0.002),
  tsla: generatePriceData(260, 48, 0.03, -0.003),
  nvda: generatePriceData(840, 48, 0.02, 0.004),
  eurusd: generatePriceData(1.08, 48, 0.003, 0.0005),
  usdjpy: generatePriceData(155, 48, 0.005, 0.001),
  gold: generatePriceData(2350, 48, 0.006, 0.002),
  oil: generatePriceData(81, 48, 0.015, -0.002),
};

export const getChartData = (instrumentId: string) =>
  chartDataMap[instrumentId] || chartDataMap.btc;
