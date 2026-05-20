
"use client";

import { useState, useMemo } from "react";
import { Calendar as CalendarIcon, MapPin, Users, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { collection, addDoc, serverTimestamp, query, where, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function EventsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Resolve current church context
  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, "churches"), where("adminEmails", "array-contains", user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const eventsRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, "churches", currentChurch.id, "events");
  }, [db, currentChurch?.id]);

  const { data: events, loading } = useCollection(eventsRef);

  const [newEvent, setNewEvent] = useState({
    title: "",
    date: new Date().toISOString().split('T')[0],
    time: "09:00 AM",
    location: "Main Sanctuary",
    type: "Service",
    registrations: 0
  });

  const handleCreateEvent = () => {
    if (!newEvent.title || !eventsRef) return;
    
    const eventData = {
      ...newEvent,
      createdAt: serverTimestamp()
    };

    addDoc(eventsRef, eventData)
      .then(() => {
        setIsDialogOpen(false);
        setNewEvent({ title: "", date: new Date().toISOString().split('T')[0], time: "09:00 AM", location: "Main Sanctuary", type: "Service", registrations: 0 });
        toast({ title: "Event created successfully" });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: eventsRef.path,
          operation: 'create',
          requestResourceData: eventData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Events</h2>
          <p className="text-muted-foreground">Plan and manage gatherings for {currentChurch?.name || "your ministry"}.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/80" disabled={!currentChurch}>
              <Plus className="mr-2 h-4 w-4" /> Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateEvent}>Create Event</Button>
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
              <div className="h-32 bg-primary/10 flex items-center justify-center border-b border-border">
                <CalendarIcon className="h-12 w-12 text-primary/40 group-hover:scale-110 transition-transform" />
              </div>
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="text-xs">{event.type}</Badge>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Users className="mr-1 h-3 w-3" /> {event.registrations || 0}
                  </div>
                </div>
                <CardTitle className="text-xl">{event.title}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" /> {event.date} • {event.time}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mb-4">
                  <MapPin className="h-3 w-3" /> {event.location}
                </p>
                <Button variant="outline" className="w-full border-border hover:bg-muted">
                  Manage Event
                </Button>
              </CardContent>
            </Card>
          ))}
          {events?.length === 0 && (
            <div className="col-span-full py-20 text-center glass rounded-3xl border-dashed border-primary/20">
              <p className="text-muted-foreground">No events planned yet. Click "Create Event" to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
