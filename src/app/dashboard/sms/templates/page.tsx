'use client';

import { useMemo } from 'react';
import { 
  Layout, 
  Trash2,
  Copy,
  Plus,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, limit, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function SMSTemplatesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const churchQuery = useMemo(() => {
    if (!user?.email) return null;
    return query(collection(db, 'churches'), where('adminEmails', 'array-contains', user.email.toLowerCase().trim()), limit(1));
  }, [db, user?.email]);
  
  const { data: churches, loading: churchLoading } = useCollection(churchQuery);
  const currentChurch = churches?.[0];

  const templatesRef = useMemo(() => {
    if (!currentChurch?.id) return null;
    return collection(db, 'churches', currentChurch.id, 'smsTemplates');
  }, [db, currentChurch?.id]);

  const { data: templates, loading: templatesLoading } = useCollection(templatesRef ? query(templatesRef) : null);

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
    // In a real app, we might pass this state to the dashboard via a context or search params
    toast({ title: 'Template copied', description: 'Redirecting to workspace...' });
    router.push('/dashboard/sms');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Message Templates</h2>
          <p className="text-muted-foreground">Manage your reusable greetings and announcement structures.</p>
        </div>
        <Button onClick={() => router.push('/dashboard/sms')} className="bg-primary">
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {templatesLoading ? (
          <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : templates?.map((t) => (
          <Card key={t.id} className="glass hover:border-primary/30 transition-all group">
            <CardHeader>
              <CardTitle className="text-sm font-bold">{t.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground line-clamp-3 mb-4">{t.content}</p>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border pt-4">
              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10" onClick={() => handleUse(t.content)}>
                <Copy className="w-3 h-3 mr-1" /> Use
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(t.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </CardFooter>
          </Card>
        ))}
        {templates?.length === 0 && !templatesLoading && (
          <div className="col-span-full py-20 text-center opacity-40">
            <Layout className="w-12 h-12 mx-auto mb-4" />
            <p>No templates saved yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}