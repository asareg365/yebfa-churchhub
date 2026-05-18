
"use client";

import { useState } from "react";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Loader2, BrainCircuit } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MOCK_CHURCH, MOCK_ATTENDANCE, MOCK_FINANCES } from "@/app/lib/mock-data";
import { aiPastoralInsightTool, AIPastoralInsightOutput } from "@/ai/flows/ai-pastoral-insight-tool";
import { useToast } from "@/hooks/use-toast";

export default function InsightsPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<AIPastoralInsightOutput | null>(null);
  const { toast } = useToast();

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await aiPastoralInsightTool({
        churchName: MOCK_CHURCH.name,
        attendanceRecords: MOCK_ATTENDANCE,
        financialRecords: MOCK_FINANCES,
        currentChallenges: "Slight dip in youth attendance mid-month.",
        desiredOutcomes: "Increase youth engagement and retention."
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
          disabled={isAnalyzing}
          className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-lg shadow-primary/20 px-8 h-12 rounded-2xl"
        >
          {isAnalyzing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <BrainCircuit className="mr-2 h-5 w-5" />}
          Run AI Analysis
        </Button>
      </div>

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
    </div>
  );
}
