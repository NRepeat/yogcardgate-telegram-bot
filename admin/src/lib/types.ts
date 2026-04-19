export interface Rate {
  id: string;
  currency: string;
  method: string;
  minAmount: number;
  maxAmount: number;
  rate: number;
  enabled: boolean;
  xml?: string;
}

export interface User {
  id: string;
  username: string;
  telegramId: string;
  onPause: boolean;
  roles: string[];
}

export interface Role {
  id: string;
  name: string;
}

export interface Vendor {
  id: string;
  title: string;
  chatId: string;
  work: boolean;
  showReceipt: boolean;
  token: string | null;
}

export interface RequestItem {
  id: string;
  amount: number;
  status: string;
  currency: string;
  method: string;
  vendor: string;
  worker: string;
  payedBy: string;
  rate: string;
  createdAt: string;
  completedAt: string | null;
}

export interface RequestsResponse {
  data: RequestItem[];
  total: number;
  page: number;
  pages: number;
}

export interface WorkerStats {
  id: string;
  username: string;
  telegramId: string;
  onPause: boolean;
  roles: string[];
  stats: {
    total: number;
    completed: number;
    failed: number;
    active: number;
    totalAmount: number;
    completedToday: number;
    todayAmount: number;
    completedWeek: number;
    weekAmount: number;
    completedMonth: number;
    monthAmount: number;
    successRate: number;
    avgCompletionMin: number;
    fastestMin: number;
    streak: number;
    dailyCompleted: number[];
  };
}

export interface DashboardStats {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  pendingRequests: number;
  totalVolume: number;
  todayRequests: number;
  todayVolume: number;
  successRate: number;
  avgCompletionMinutes: number;
  dailyData: { date: string; count: number; volume: number }[];
  byCurrency: { currency: string; count: number; volume: number }[];
  byMethod: { method: string; count: number; volume: number }[];
  byStatus: { status: string; count: number }[];
}
