export type SignalType = 'BUY' | 'SELL' | 'HOLD' | 'BUY_URGENT' | 'SELL_URGENT';
export type SignalStatus = 'new' | 'seen' | 'informed';

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  category: 'crypto' | 'stocks' | 'forex' | 'commodities';
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: string;
  marketCap?: string;
  currency: string;
  iconEmoji: string;
}

export interface Signal {
  id: string;
  instrumentId: string;
  instrumentSymbol: string;
  instrumentName: string;
  type: SignalType;
  price: number;
  targetPrice: number;
  stopLoss: number;
  potential: number;
  timeframe: string;
  description: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
  status: SignalStatus;
  isUrgent: boolean;
  iconEmoji: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'urgent' | 'info' | 'signal';
  isRead: boolean;
  createdAt: string;
  signalId?: string;
}

export interface ChartDataPoint {
  time: string;
  value: number;
}
