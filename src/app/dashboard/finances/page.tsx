
"use client";

import { CreditCard, ArrowUpRight, ArrowDownRight, DollarSign, Wallet, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MOCK_FINANCES } from "@/app/lib/mock-data";

export default function FinancesPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Finances</h2>
          <p className="text-muted-foreground">Detailed overview of tithes, offerings, and expenditures.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="glass border-white/10">
            <FileText className="mr-2 h-4 w-4" /> Reports
          </Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/80">
            <DollarSign className="mr-2 h-4 w-4" /> Add Transaction
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$124,500.00</div>
            <p className="text-xs text-accent flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" /> +12% this month
            </p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Tithes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$38,200.00</div>
            <p className="text-xs text-accent flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" /> +5.4% from avg
            </p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expenditures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$12,450.00</div>
            <p className="text-xs text-muted-foreground mt-1">Within budget</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Next Goal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">75%</div>
            <p className="text-xs text-muted-foreground mt-1">Building fund progress</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-white/5">
        <CardHeader>
          <CardTitle className="text-lg">Recent Contributions</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_FINANCES.map((record, i) => (
              <TableRow key={i} className="border-white/5">
                <TableCell>{record.date}</TableCell>
                <TableCell>{record.type}</TableCell>
                <TableCell className="font-semibold text-accent">${record.amount.toLocaleString()}</TableCell>
                <TableCell>Bank Transfer</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">Verified</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
