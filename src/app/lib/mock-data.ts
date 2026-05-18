
export const MOCK_CHURCH = {
  id: "tenant-123",
  name: "Grace Community Sanctuary",
  logo: "https://picsum.photos/seed/church1/200/200",
  plan: "Premium",
  stats: {
    totalMembers: 1240,
    activeEvents: 8,
    monthlyIncome: 45200,
    attendanceRate: 85,
    upcomingBirthdays: 12
  }
};

export const MOCK_MEMBERS = [
  { id: "1", name: "John Doe", gender: "Male", department: "Music", status: "Active", joined: "2023-01-15", photo: "https://picsum.photos/seed/m1/100/100" },
  { id: "2", name: "Jane Smith", gender: "Female", department: "Youth", status: "Active", joined: "2023-05-20", photo: "https://picsum.photos/seed/m2/100/100" },
  { id: "3", name: "Samuel Wilson", gender: "Male", department: "Media", status: "Probation", joined: "2024-02-10", photo: "https://picsum.photos/seed/m3/100/100" },
  { id: "4", name: "Grace Adams", gender: "Female", department: "Children", status: "Active", joined: "2022-11-30", photo: "https://picsum.photos/seed/m4/100/100" },
];

export const MOCK_ATTENDANCE = [
  { date: "2024-03-03", count: 850 },
  { date: "2024-03-10", count: 920 },
  { date: "2024-03-17", count: 880 },
  { date: "2024-03-24", count: 950 },
  { date: "2024-03-31", count: 1100 },
];

export const MOCK_FINANCES = [
  { date: "2024-01-01", amount: 12000, type: "Tithe" },
  { date: "2024-01-15", amount: 5000, type: "Offering" },
  { date: "2024-02-01", amount: 15000, type: "Tithe" },
  { date: "2024-02-15", amount: 8000, type: "Donation" },
  { date: "2024-03-01", amount: 18000, type: "Tithe" },
];
