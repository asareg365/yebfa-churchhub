'use client';

import { useState, useMemo } from 'react';
import { 
  Layout, 
  Trash2,
  Copy,
  Plus,
  Loader2,
  Pencil,
  Info,
  Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, deleteDoc, doc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

const DEFAULT_TEMPLATES = [
  { name: "Birthday Wishes", content: "Happy Birthday {memberName}! God bless your new age. From {churchName}.", category: "Occasion" },
  { name: "Event Reminder", content: "Don't forget our {eventName} this Sunday at {eventTime}. See you there!", category: "Service" },
  { name: "Prayer Meeting", content: "Join us for {eventName} at {eventLocation}. God is about to do something new!", category: "Meeting" },
];

export default function SMSTemplatesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', content: '', category: 'General' });

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const templatesRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, 'churches', currentChurch.id, 'smsTemplates');
  }, [db, currentChurch?.id]);

  const { data: templates, loading: templatesLoading } = useCollection(templatesRef ? query(templatesRef) : null);

  const handleSave = async () => {
    if (!templatesRef || !formData.name || !formData.content) return;
    
    try {
      if (editingTemplate) {
        await updateDoc(doc(templatesRef, editingTemplate.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast({ title: 'Template updated' });
      } else {
        await addDoc(templatesRef, {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast({ title: 'Template created' });
      }
      setIsDialogOpen(false);
      setFormData({ name: '', content: '', category: 'General' });
      setEditingTemplate(null);
    } catch (error) {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!templatesRef) return;
    try {
      await deleteDoc(doc(templatesRef, id));
      toast({ title: 'Template deleted' });
    } catch (error) {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const handleUse = (content: string) => {
    router.push(`/dashboard/sms?draft=${encodeURIComponent(content)}`);
  };

  const handleAddDefault = async (temp: typeof DEFAULT_TEMPLATES[0]) => {
    if (!templatesRef) return;
    try {
      await addDoc(templatesRef, {
        ...temp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast({ title: 'Default template added' });
    } catch (e) {}
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Message Templates</h2>
          <p className="text-muted-foreground">Manage reusable structures for greetings and announcements.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) {setEditingTemplate(null); setFormData({name:'', content:'', category:'General'})}}}>
          <DialogTrigger asChild>
            <Button className="bg-primary px-6 rounded-xl">
              <Plus className="w-4 h-4 mr-2" /> Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit Template' : 'New SMS Template'}</DialogTitle>
              <DialogDescription>Use placeholders like {"{memberName}"}, {"{churchName}"}, or {"{eventName}"}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Birthday Greeting" className="bg-muted/30" />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="Type your message here..." className="min-h-[120px] bg-muted/30" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Template</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 grid gap-4 grid-cols-1 sm:grid-cols-2">
          {templatesLoading ? (
            <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : templates?.map((t) => (
            <Card key={t.id} className="glass hover:border-primary/30 transition-all group flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="secondary" className="text-[9px] mb-2">{t.category || 'General'}</Badge>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingTemplate(t); setFormData({name: t.name, content: t.content, category: t.category}); setIsDialogOpen(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-base font-bold">{t.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-xs text-muted-foreground line-clamp-4 italic leading-relaxed">
                  "{t.content}"
                </p>
              </CardContent>
              <CardFooter className="pt-4 border-t border-border mt-auto">
                <Button variant="default" size="sm" className="w-full bg-primary/10 text-primary hover:bg-primary/20 border-0 rounded-lg" onClick={() => handleUse(t.content)}>
                  <Copy className="w-3 h-3 mr-2" /> Use Template
                </Button>
              </CardFooter>
            </Card>
          ))}
          {templates?.length === 0 && !templatesLoading && (
            <div className="col-span-full py-20 text-center opacity-40 glass rounded-3xl border-dashed">
              <Layout className="w-12 h-12 mx-auto mb-4" />
              <p>Your template library is empty.</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="glass border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Quick Library
              </CardTitle>
              <CardDescription className="text-[10px]">Add standard templates to your library.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {DEFAULT_TEMPLATES.map((temp, i) => (
                <div key={i} className="p-3 rounded-xl bg-muted/20 border border-border flex items-center justify-between group">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{temp.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{temp.category}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg group-hover:bg-primary/20 group-hover:text-primary" onClick={() => handleAddDefault(temp)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass bg-accent/5 border-accent/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Dynamic Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-[10px] text-muted-foreground">Supported placeholders:</p>
              <div className="flex flex-wrap gap-1">
                {['{memberName}', '{churchName}', '{eventName}', '{pastorName}', '{eventTime}'].map(tag => (
                  <Badge key={tag} variant="outline" className="text-[9px] font-mono bg-white">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
