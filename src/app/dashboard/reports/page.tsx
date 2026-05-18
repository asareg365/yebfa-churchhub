
"use client";

import { BarChart3, Download, FileSpreadsheet, FileJson, Calendar, Filter, FileText, History, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

const reports = [
  { title: "Monthly Attendance Summary", date: "March 2024", type: "PDF", size: "2.4 MB" },
  { title: "Financial Quarter Analysis", date: "Q1 2024", type: "Excel", size: "1.1 MB" },
  { title: "Member Demographic Report", date: "Annual 2023", type: "PDF", size: "4.8 MB" },
  { title: "Engagement Metrics Overview", date: "Last 30 Days", type: "CSV", size: "850 KB" },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Reports</h2>
        <p className="text-muted-foreground">Access and download data-driven insights for your ministry.</p>
      </div>

      <Tabs defaultValue="directory" className="space-y-6">
        <TabsList className="glass border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="directory" className="rounded-xl px-6">
            <History className="w-4 h-4 mr-2" />
            Report History
          </TabsTrigger>
          <TabsTrigger value="generator" className="rounded-xl px-6">
            <BarChart3 className="w-4 h-4 mr-2" />
            Custom Generator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="animate-in fade-in-50 duration-500">
          <div className="grid gap-6">
            <Card className="glass">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">Recent Downloads</CardTitle>
                  <CardDescription>A list of your recently generated reports.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search reports..." className="pl-10 bg-white/5 border-white/10 rounded-xl h-9" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {reports.map((report, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        {report.type === 'Excel' ? <FileSpreadsheet className="h-6 w-6 text-accent" /> : <FileText className="h-6 w-6 text-primary" />}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{report.title}</p>
                        <p className="text-xs text-muted-foreground">{report.date} • {report.size} • {report.type}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/20">
                      <Download className="h-5 w-5 text-primary" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="generator" className="animate-in fade-in-50 duration-500">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Configure Report
                </CardTitle>
                <CardDescription>Select filters and data points for your new report.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-24 border-white/10 hover:border-primary/50 hover:bg-primary/5 flex flex-col gap-2 rounded-2xl transition-all">
                    <Calendar className="h-6 w-6 text-primary" />
                    <span className="text-sm font-bold">Time Period</span>
                  </Button>
                  <Button variant="outline" className="h-24 border-white/10 hover:border-primary/50 hover:bg-primary/5 flex flex-col gap-2 rounded-2xl transition-all">
                    <Filter className="h-6 w-6 text-accent" />
                    <span className="text-sm font-bold">Category</span>
                  </Button>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Select Output Format</p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 rounded-xl border-white/10">PDF</Button>
                    <Button variant="outline" className="flex-1 rounded-xl border-white/10">Excel</Button>
                    <Button variant="outline" className="flex-1 rounded-xl border-white/10">CSV</Button>
                  </div>
                </div>
                <Button className="w-full bg-primary text-primary-foreground h-12 rounded-xl shadow-lg shadow-primary/20 font-bold">
                  Generate Custom Report
                </Button>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Generation Summary</CardTitle>
                <CardDescription>Quick overview of the report you're about to build.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Data Type</span>
                    <span className="font-semibold">Financial & Attendance</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Range</span>
                    <span className="font-semibold">Last 3 Months</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Size</span>
                    <span className="font-semibold">~1.5 MB</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
