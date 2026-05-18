
"use client";

import { Calendar as CalendarIcon, MapPin, Users, Plus, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const upcomingEvents = [
  {
    id: 1,
    title: "Easter Sunday Celebration",
    date: "April 14, 2024",
    time: "09:00 AM",
    location: "Main Sanctuary",
    type: "Service",
    registrations: 450
  },
  {
    id: 2,
    title: "Youth Leadership Retreat",
    date: "April 20-22, 2024",
    time: "All Day",
    location: "Hope Camp Site",
    type: "Retreat",
    registrations: 85
  },
  {
    id: 3,
    title: "Monthly Bible Study",
    date: "April 25, 2024",
    time: "06:30 PM",
    location: "Fellowship Hall",
    type: "Study",
    registrations: 120
  }
];

export default function EventsPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Events</h2>
          <p className="text-muted-foreground">Plan and manage upcoming church activities and gatherings.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/80">
          <Plus className="mr-2 h-4 w-4" /> Create Event
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {upcomingEvents.map((event) => (
          <Card key={event.id} className="glass hover:border-primary/40 transition-all overflow-hidden group">
            <div className="h-32 bg-primary/10 flex items-center justify-center border-b border-white/5">
              <CalendarIcon className="h-12 w-12 text-primary/40 group-hover:scale-110 transition-transform" />
            </div>
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className="text-xs">{event.type}</Badge>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Users className="mr-1 h-3 w-3" /> {event.registrations}
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
              <Button variant="outline" className="w-full border-white/10 hover:bg-white/5">
                Manage Event
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
