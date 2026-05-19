
"use client";

import { useState, useMemo } from "react";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Loader2, BrainCircuit, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { aiPastoralInsightTool, AIPastoralInsightOutput } from "@/ai/flows/ai-pastoral-insight-tool";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";

export default function InsightsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<AIPastoralInsightOutput | null>(null);
  const { toast } = useToast();

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);

  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const attendanceRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, "churches", currentChurch.id, "attendance");
  }, [db, currentChurch?.id]);

  const financesRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, "churches", currentChurch.id, "finances");
  }, [db, currentChurch?.id]);

  const { data: attendance } = useCollection(attendanceRef);
  const { data: finances } = useCollection(financesRef);

  const runAnalysis = async () => {
    if (!currentChurch) {
      toast({ title: "Ministry context required", description: "Could not find your ministry record.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await aiPastoralInsightTool({
        churchName: currentChurch.name || "Our Ministry",
        attendanceRecords: attendance.map(a => ({ date: a.date, count: a.count })),
        financialRecords: finances.map(f => ({ date: f.date, amount: f.amount, type: f.type })),
        currentChallenges: "General analysis requested for recent growth trends.",
        desiredOutcomes: "Improve community engagement and retention."
      });
      setInsights(result);
      toast({ title: "Analysis complete", description: "Fresh pastoral insights are ready." });
    } catch (error) {
      toast({ title: "Analysis failed", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">AI Pastoral Insights</h2>
          <p className="text-muted-foreground">Deep data analysis to foster spiritual growth and community engagement.</p>
        </div>
        <Button 
          onClick={runAnalysis} 
          disabled={isAnalyzing || !currentChurch}
          className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-lg shadow-primary/20 px-8 h-12 rounded-2xl"
        >
          {isAnalyzing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <BrainCircuit className="mr-2 h-5 w-5" />}
          Run AI Analysis
        </Button>
      </div>

      <Tabs defaultValue="current" className="space-y-6">
        <TabsList className="glass border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="current" className="rounded-xl px-6">
            <Sparkles className="w-4 h-4 mr-2" />
            Current Analysis
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl px-6">
            <History className="w-4 h-4 mr-2" />
            Insight History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="animate-in fade-in-50 duration-500">
          {!insights ? (
            <div className="h-[400px] flex flex-col items-center justify-center glass rounded-3xl border-dashed border-primary/20">
              <Sparkles className="h-16 w-16 text-primary/20 mb-4 animate-pulse" />
              <h3 className="text-xl font-semibold text-muted-foreground">No analysis data yet</h3>
              <p className="text-sm text-muted-foreground">Click the button above to analyze your church's health.</p>
            </div>
          ) : (
            <div className="grid gap-6 animate-in zoom-in-95 duration-500">
              <Card className="glass border-primary/30 shadow-2xl overflow-hidden">
                <CardHeader className="bg-primary/5">
                  <CardTitle className="flex items-center gap-3">
                    <Sparkles className="h-6 w-6 text-primary" />
                    Executive Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-lg leading-relaxed text-foreground/90 italic">"{insights.summaryInsight}"</p>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-3">
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-accent">
                      <TrendingUp className="h-5 w-5" />
                      Growth Strategies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {insights.growthStrategies.map((strategy, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <div className="h-2 w-2 rounded-full bg-accent mt-1.5 shrink-0" />
                          <span>{strategy}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <Lightbulb className="h-5 w-5" />
                      Engagement Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {insights.engagementRecommendations.map((tip, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="glass border-destructive/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      Risk Factors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {insights.potentialRisks.map((risk, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <div className="h-2 w-2 rounded-full bg-destructive mt-1.5 shrink-0" />
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="animate-in fade-in-50 duration-500">
          <Card className="glass h-[300px] flex flex-col items-center justify-center text-center p-12">
            <History className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">Insight Archive</h3>
            <p className="text-sm text-muted-foreground max-w-sm">Past analysis results will be stored here for tracking progress over time.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
