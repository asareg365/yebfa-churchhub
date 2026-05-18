
"use client";

import { useState } from "react";
import { Send, Sparkles, Users, MessageSquare, Megaphone, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aiCommunicationAssistant } from "@/ai/flows/ai-communication-assistant";
import { useToast } from "@/hooks/use-toast";

export default function CommunicationPage() {
  const [topic, setTopic] = useState("");
  const [targetAudience, setTargetAudience] = useState("all members");
  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState("");
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!topic) {
      toast({ title: "Topic required", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await aiCommunicationAssistant({ topic, targetAudience });
      setDraft(result.draftMessage);
      toast({ title: "Draft generated successfully!" });
    } catch (error) {
      toast({ title: "Generation failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Communications</h2>
        <p className="text-muted-foreground">Connect with your congregation through AI-powered drafting and bulk SMS.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Draft Assistant
            </CardTitle>
            <CardDescription>Generate tailored messages for any audience in seconds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Main Topic</Label>
              <Input 
                placeholder="e.g., Youth Camp 2024 registration details" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select value={targetAudience} onValueChange={setTargetAudience}>
                <SelectTrigger className="bg-white/5">
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent className="glass">
                  <SelectItem value="all members">All Members</SelectItem>
                  <SelectItem value="youth group">Youth Group</SelectItem>
                  <SelectItem value="church elders">Church Elders</SelectItem>
                  <SelectItem value="new visitors">New Visitors</SelectItem>
                  <SelectItem value="choir members">Choir Members</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/80" 
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Draft
            </Button>
          </CardContent>
        </Card>

        <Card className="glass overflow-hidden flex flex-col">
          <CardHeader className="bg-primary/5 border-b border-white/5">
            <CardTitle className="text-lg">Message Workspace</CardTitle>
            <CardDescription>Refine and send your message across channels.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 flex flex-col">
            <Textarea 
              className="flex-1 p-6 bg-transparent border-0 focus-visible:ring-0 resize-none min-h-[300px]"
              placeholder="Your draft will appear here..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="p-4 border-t border-white/5 bg-white/5 flex gap-2">
              <Button variant="outline" className="flex-1 border-white/10 hover:bg-white/10">
                <Users className="mr-2 h-4 w-4" /> Save as Template
              </Button>
              <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/80">
                <Send className="mr-2 h-4 w-4" /> Send Bulk SMS
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">12,450</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">SMS Credits Left</p>
          </div>
        </Card>
        <Card className="glass p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">98.2%</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Delivery Rate</p>
          </div>
        </Card>
        <Card className="glass p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-muted/10 flex items-center justify-center text-muted-foreground">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold">42</p>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Active Templates</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
