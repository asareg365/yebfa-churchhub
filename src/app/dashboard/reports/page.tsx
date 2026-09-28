"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download, FileSpreadsheet, FileText, History, Search, Loader2, Calendar, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, where, limit, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import { useTenant } from "@/context/tenant-context";

export default function ReportsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { currentChurch, loading: churchLoading } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");

  const reportsRef = useMemo(() => {
    if (!currentChurch?.id || !db) return null;
    return collection(db, "churches", currentChurch.id, "reports");
  }, [db, currentChurch?.id]);

  const { data: dbReports, loading } = useCollection(reportsRef ? query(reportsRef, orderBy("createdAt", "desc")) : null);

  const filteredReports = useMemo(() => {
    if (!dbReports) return [];
    return dbReports.filter(r => r.title?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [dbReports, searchTerm]);

  if (churchLoading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Reports Hub</h2>
        <p className="text-muted-foreground">Access all generated audit statements for {currentChurch?.name}.</p>
      </div>

      <Tabs defaultValue="directory" className="space-y-6">
        <TabsList className="glass border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="directory" className="rounded-xl px-6"><History className="w-4 h-4 mr-2" />Report History</TabsTrigger>
          <TabsTrigger value="generator" className="rounded-xl px-6"><BarChart3 className="w-4 h-4 mr-2" />Custom Generator</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-6">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Statements</CardTitle>
                <CardDescription>Archive of processed organizational data.</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search archive..." className="pl-10 h-10 rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : filteredReports.length > 0 ? (
                filteredReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        {report.category === 'Financial' ? <FileSpreadsheet className="h-6 w-6 text-accent" /> : <FileText className="h-6 w-6 text-primary" />}
                      </div>
                      <div>
                        <p className="font-semibold">{report.title}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                          {report.date} • {report.size} • {report.category}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/20">
                      <Download className="h-5 w-5 text-primary" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="py-24 text-center opacity-40">
                  <FileText className="w-12 h-12 mx-auto mb-4" />
                  <p>No archived statements found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generator" className="grid gap-6 md:grid-cols-2">
            <Card className="glass border-primary/20">
              <CardHeader>
                <CardTitle>Manual Generation</CardTitle>
                <CardDescription>Compile a fresh set of data points.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-24 flex flex-col gap-2 rounded-2xl"><Calendar className="h-6 w-6 text-primary" /><span>Time Period</span></Button>
                  <Button variant="outline" className="h-24 flex flex-col gap-2 rounded-2xl"><Filter className="h-6 w-6 text-accent" /><span>Category</span></Button>
                </div>
                <Button className="w-full bg-primary h-12 rounded-xl font-bold">Start Batch Generation</Button>
              </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
