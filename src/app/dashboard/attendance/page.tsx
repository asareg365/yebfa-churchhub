
"use client";

import { CheckCircle2, Clock, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const recentAttendance = [
  { id: 1, date: "2024-03-31", service: "Sunday First Service", count: 450, growth: "+5%" },
  { id: 2, date: "2024-03-31", service: "Sunday Second Service", count: 650, growth: "+12%" },
  { id: 3, date: "2024-03-27", service: "Mid-week Prayer", count: 180, growth: "-2%" },
  { id: 4, date: "2024-03-24", service: "Sunday Service", count: 950, growth: "+8%" },
];

export default function AttendancePage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Attendance</h2>
        <p className="text-muted-foreground">Monitor congregation presence and service trends.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">1,100</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Last Sunday Total</p>
          </div>
        </Card>
        <Card className="glass p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">85%</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Avg. Retention</p>
          </div>
        </Card>
        <Card className="glass p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-muted/10 flex items-center justify-center text-muted-foreground">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">45 min</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Peak Check-in Time</p>
          </div>
        </Card>
      </div>

      <Card className="glass overflow-hidden border border-white/5">
        <CardHeader className="bg-white/5 border-b border-white/5">
          <CardTitle className="text-lg">Recent Service Records</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="border-white/5">
              <TableHead>Date</TableHead>
              <TableHead>Service Name</TableHead>
              <TableHead>Headcount</TableHead>
              <TableHead>Growth</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentAttendance.map((record) => (
              <TableRow key={record.id} className="hover:bg-white/5 transition-colors border-white/5">
                <TableCell className="font-medium">{record.date}</TableCell>
                <TableCell>{record.service}</TableCell>
                <TableCell>{record.count}</TableCell>
                <TableCell>
                  <Badge variant={record.growth.startsWith('+') ? "secondary" : "destructive"} className="bg-opacity-10">
                    {record.growth}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">Details</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
