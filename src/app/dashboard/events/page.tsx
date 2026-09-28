"use client";

import { useState, useMemo, useEffect } from "react";
import { Calendar as CalendarIcon, MapPin, Users, Plus, Loader2, MessageSquare, Clock, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, where, limit, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTenant } from "@/context/tenant-context";

export default function EventsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { currentChurch, loading: churchLoading } = useTenant();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const eventsRef = useMemo(() => {
    if (!currentChurch?.id || !db) return null;
    return collection(db, "churches", currentChurch.id, "events");
  }, [db, currentChurch?.id]);

  const { data: events, loading } = useCollection(eventsRef);

  const [newEvent, setNewEvent] = useState({
    title: "",
    date: new Date().toISOString().split('T')[0],
    time: "09:00 AM",
    location: "Main Sanctuary",
    type: "Service",
    smsReminderEnabled: true
  });

  const handleCreateEvent = async () => {
    if (!newEvent.title || !eventsRef) return;
    try {
      await addDoc(eventsRef, {
        ...newEvent,
        registrations: 0,
        createdAt: serverTimestamp()
      });
      setIsDialogOpen(false);
      setNewEvent({ title: "", date: new Date().toISOString().split('T')[0], time: "09:00 AM", location: "Main Sanctuary", type: "Service", smsReminderEnabled: true });
      toast({ title: "Event created successfully", description: "SMS reminders are active for this event." });
    } catch (e: any) {
      toast({ title: "Failed to create event", variant: "destructive" });
    }
  };

  const toggleReminder = async (eventId: string, current: boolean) => {
    if (!eventsRef) return;
    try {
      await updateDoc(doc(eventsRef, eventId), { smsReminderEnabled: !current });
      toast({ title: !current ? "SMS Reminders Enabled" : "SMS Reminders Disabled" });
    } catch (e: any) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!eventsRef) return;
    try {
      await deleteDoc(doc(eventsRef, id));
      toast({ title: "Event removed" });
    } catch (e) {}
  };

  if (churchLoading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Events & Gatherings</h2>
          <p className="text-muted-foreground">Manage service schedules and community meetings for {currentChurch?.name}.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 rounded-xl" disabled={!currentChurch}>
              <Plus className="mr-2 h-4 w-4" /> Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader>
              <DialogTitle>New Event Configuration</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Event Title</Label>
                <Input value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} placeholder="e.g. Easter Celebration" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input value={newEvent.time} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} placeholder="09:00 AM" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={newEvent.location} onChange={(e) => setNewEvent({...newEvent, location: e.target.value})} placeholder="Main Sanctuary" />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-primary/10">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Automated SMS Reminders
                  </Label>
                  <p className="text-xs text-muted-foreground">Notify all members 24h before event starts.</p>
                </div>
                <Switch 
                  checked={newEvent.smsReminderEnabled} 
                  onCheckedChange={v => setNewEvent({...newEvent, smsReminderEnabled: v})} 
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateEvent}>Confirm & Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events?.map((event) => (
            <Card key={event.id} className="glass hover:border-primary/40 transition-all overflow-hidden group">
              <div className="h-24 bg-primary/10 flex items-center justify-center border-b border-border relative">
                <CalendarIcon className="h-10 w-10 text-primary/40 group-hover:scale-110 transition-transform" />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(event.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">{event.type}</Badge>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Users className="mr-1 h-3 w-3" /> {event.registrations || 0}
                  </div>
                </div>
                <CardTitle className="text-lg font-bold truncate">{event.title}</CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" /> {event.date} • {event.time}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-primary" /> {event.location}
                </p>
                <div className="pt-4 border-t border-border flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <MessageSquare className={cn("w-4 h-4", event.smsReminderEnabled ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">SMS Reminder</span>
                   </div>
                   <Switch 
                     checked={event.smsReminderEnabled} 
                     onCheckedChange={() => toggleReminder(event.id, event.smsReminderEnabled)} 
                     className="scale-75"
                   />
                </div>
              </CardContent>
            </Card>
          ))}
          {events?.length === 0 && (
            <div className="col-span-full py-32 text-center glass rounded-3xl border-dashed border-primary/20">
              <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p className="text-muted-foreground">Your event calendar is empty.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
