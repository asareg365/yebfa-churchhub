"use client";

import { useState, useMemo, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  Cake,
  Activity,
  DollarSign,
  Loader2,
  Gift,
  Search,
  Send,
  MessageSquare,
  CreditCard
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from '@/lib/utils';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useSearch } from '@/context/search-context';
import { sendAndLogSMS } from '@/services/sms-service';
import { useToast } from '@/hooks/use-toast';

const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default function DashboardPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { searchTerm } = useSearch();
  const { toast } = useToast();

  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const churchQuery = useMemo(() => {
    if (!user?.email || !db) return null;
    const normalizedEmail = user.email.toLowerCase().trim();
    return query(
      collection(db, 'churches'),
      where('adminEmails', 'array-contains', normalizedEmail),
      limit(1)
    );
  }, [db, user?.email]);

  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const membersRef = useMemo(() => {
    if (!currentChurch?.id || !db) return null;
    return collection(db, 'churches', currentChurch.id, 'members');
  }, [db, currentChurch?.id]);

  const attendanceRef = useMemo(() => {
    if (!currentChurch?.id || !db) return null;
    return collection(db, 'churches', currentChurch.id, 'attendance');
  }, [db, currentChurch?.id]);

  const financesRef = useMemo(() => {
    if (!currentChurch?.id || !db) return null;
    return collection(db, 'churches', currentChurch.id, 'finances');
  }, [db, currentChurch?.id]);

  const { data: members, loading: membersLoading } = useCollection(membersRef);

  const attendanceQuery = useMemo(() => {
    if (!attendanceRef) return null;
    return query(attendanceRef, orderBy('date', 'desc'), limit(10));
  }, [attendanceRef]);

  const { data: attendance } = useCollection(attendanceQuery);
  const { data: finances } = useCollection(financesRef);

  const stats = [
    {
      label: 'Total Members',
      value: members?.length || 0,
      icon: Users,
      trend: (members?.length || 0) > 0 ? '+1' : 'N/A',
      trendUp: true,
    },
    {
      label: 'Upcoming Birthdays',
      value:
        members?.filter((m) => {
          if (!m.dateOfBirth) return false;
          const birthDate = new Date(m.dateOfBirth);
          return birthDate.getMonth() === new Date().getMonth();
        }).length || 0,
      icon: Cake,
      trend: 'This Month',
      trendUp: true,
    },
    {
      label: 'Total Attendance',
      value:
        attendance?.reduce((acc, curr) => acc + (curr.count || 0), 0) || 0,
      icon: TrendingUp,
      trend: 'Live',
      trendUp: true,
    },
    {
      label: 'Ministry Health',
      value: currentChurch?.status === 'Approved' ? 'Active' : 'Pending',
      icon: Activity,
      trend: 'Status',
      trendUp: true,
    },
  ];

  const birthdayMembers = useMemo(() => {
    if (!members) return [];
    return members
      .filter((m) => {
        if (!m.dateOfBirth) return false;
        const birthDate = new Date(m.dateOfBirth);
        const matchesMonth = birthDate.getMonth() === new Date().getMonth();
        const matchesSearch = m.name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesMonth && matchesSearch;
      })
      .sort((a, b) => {
        const dayA = new Date(a.dateOfBirth).getDate();
        const dayB = new Date(b.dateOfBirth).getDate();
        return dayA - dayB;
      });
  }, [members, searchTerm]);

  const totalBalance = (finances || []).reduce(
    (acc, curr) =>
      curr.type === 'Expenditure' ? acc - curr.amount : acc + curr.amount,
    0
  );

  const handleOpenSms = (member: any) => {
    const churchDisplayName = currentChurch?.sms?.displayName || currentChurch?.name || "Our Church";
    const template = currentChurch?.smsTemplates?.birthday || "Happy Birthday {{name}}! May God bless your new age richly. — {{churchName}}";
    
    const personalized = template
      .replace(/{{name}}/g, member.name)
      .replace(/{{churchName}}/g, churchDisplayName);

    setSelectedMember(member);
    setCustomMessage(personalized);
  };

  const handleSendGreeting = async () => {
    if (!selectedMember || !currentChurch?.id || !db) return;
    setIsSending(true);
    try {
      const outcome = await sendAndLogSMS(db, currentChurch.id, {
        phone: selectedMember.phone,
        message: customMessage,
        type: 'birthday',
        memberName: selectedMember.name,
        memberId: selectedMember.id
      });

      if (outcome.success) {
        toast({ title: "Greeting Sent", description: `Message delivered to ${selectedMember.name}.` });
        setSelectedMember(null);
      } else {
        toast({ title: "Send Failed", description: outcome.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  if (!mounted) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1 text-foreground">
            Welcome back, Admin
          </h2>
          <p className="text-muted-foreground">
            Here's what's happening at {currentChurch?.name || 'your ministry'}{' '}
            today.
          </p>
        </div>
        <div className="bg-primary/10 px-4 py-2 rounded-xl border border-primary/20 text-xs font-semibold text-primary uppercase tracking-wider">
          System Live
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="group hover:border-primary/50 transition-all duration-300"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <stat.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p
                className={cn(
                  'text-xs mt-1 flex items-center gap-1',
                  stat.trendUp ? 'text-accent' : 'text-destructive'
                )}
              >
                {stat.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-2xl">
          <TabsTrigger value="trends" className="rounded-xl px-6">
            <Activity className="w-4 h-4 mr-2" />
            Attendance Trends
          </TabsTrigger>
          <TabsTrigger value="financials" className="rounded-xl px-6">
            <DollarSign className="w-4 h-4 mr-2" />
            Financial Health
          </TabsTrigger>
          <TabsTrigger value="birthdays" className="rounded-xl px-6">
            <Cake className="w-4 h-4 mr-2" />
            Birthdays
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="trends"
          className="animate-in fade-in-50 duration-500"
        >
          <Card className="h-[400px]">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Attendance Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {attendance?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[...attendance].reverse()}>
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderRadius: '12px',
                        border: '1px solid hsl(var(--border))',
                      }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      fillOpacity={0.1}
                      strokeWidth={3}
                      fill="hsl(var(--primary))"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Activity className="h-10 w-10 opacity-20 mb-2" />
                  <p>No attendance data recorded yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="financials"
          className="animate-in fade-in-50 duration-500"
        >
          <Card className="h-[400px]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-accent" />
                Financial Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-6 rounded-3xl bg-muted/20 border border-border">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                        Total Balance
                      </p>
                      <p className="text-3xl font-bold text-accent">
                        GH₵{totalBalance.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center space-y-4">
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border text-center">
                    <p className="text-xs text-muted-foreground">
                      Recent Transactions
                    </p>
                    <p className="text-xl font-bold">{finances?.length || 0}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="birthdays"
          className="animate-in fade-in-50 duration-500"
        >
          <Card className="min-h-[400px]">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-primary" />
                    Celebrants This Month
                  </CardTitle>
                  <CardDescription>
                    Members celebrating their special day in{' '}
                    {new Date().toLocaleString('default', { month: 'long' })}.
                  </CardDescription>
                </div>
                {searchTerm && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Search className="w-3 h-3" />
                    Filtering for: {searchTerm}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : birthdayMembers.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {birthdayMembers.map((member) => (
                    <div
                      key={member.id}
                      className="group flex flex-col p-4 rounded-2xl bg-muted/20 border border-border hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <Avatar className="h-12 w-12 border border-primary/20 shadow-sm">
                          <AvatarImage src={member.photo} />
                          <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground truncate">
                            {member.name}
                          </p>
                          <p className="text-sm text-primary flex items-center gap-1 font-medium">
                            <Cake className="w-3 h-3" />
                            {new Date(member.dateOfBirth).toLocaleDateString(
                              'default',
                              { month: 'long', day: 'numeric' }
                            )}
                          </p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full rounded-xl bg-white hover:bg-primary hover:text-white transition-colors border-border group-hover:border-primary/50"
                        onClick={() => handleOpenSms(member)}
                      >
                        <Send className="w-3 h-3 mr-2" />
                        Send Greeting
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-20 text-center opacity-40">
                  <Gift className="w-16 h-16 mb-4" />
                  <p>{searchTerm ? "No results matching your search." : "No birthdays recorded for this month."}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manual Greeting Dialog */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Birthday Greeting
            </DialogTitle>
            <DialogDescription>
              Sending personalized message to <strong>{selectedMember?.name}</strong> ({selectedMember?.phone}).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Message Content</label>
              <Textarea 
                value={customMessage} 
                onChange={(e) => setCustomMessage(e.target.value)} 
                className="min-h-[120px] bg-muted/30 rounded-xl resize-none"
              />
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              Estimated Cost: 1 Credit
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMember(null)}>Cancel</Button>
            <Button onClick={handleSendGreeting} disabled={isSending || !customMessage} className="bg-primary px-8">
              {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
