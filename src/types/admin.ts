
export interface ChurchSms {
  credits: number;
  sent: number;
  failed: number;
  totalTopups: number;
  subscriptionStatus: string;
  stats?: {
    sent: number;
    failed: number;
    [key: string]: number;
  };
}

export interface Church {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  deletionStatus: 'DELETED' | null;
  deletedAt: any;
  registeredAt: any;
  sms: ChurchSms;
  subscription?: {
    status: string;
    plan: string;
  };
}

export interface TopSpender {
  name: string;
  sent: number;
  balance: number;
}

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalRevenue: number;
  totalSent: number;
  totalFailed: number;
  topSpenders: TopSpender[];
}
