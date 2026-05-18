
"use client";

import { BarChart3, Download, FileSpreadsheet, FileJson, Calendar, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Custom Report Generator
            </CardTitle>
            <CardDescription>Select parameters to generate a specialized report.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-20 border-white/10 hover:border-primary/50 flex flex-col gap-2">
                <Calendar className="h-5 w-5" />
                <span className="text-xs font-bold">By Date</span>
              </Button>
              <Button variant="outline" className="h-20 border-white/10 hover:border-primary/50 flex flex-col gap-2">
                <Filter className="h-5 w-5" />
                <span className="text-xs font-bold">By Dept</span>
              </Button>
            </div>
            <Button className="w-full bg-primary text-primary-foreground">Generate New Report</Button>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Recent Downloads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reports.map((report, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
                    {report.type === 'Excel' ? <FileSpreadsheet className="h-5 w-5 text-accent" /> : <Download className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{report.title}</p>
                    <p className="text-xs text-muted-foreground">{report.date} • {report.size}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
