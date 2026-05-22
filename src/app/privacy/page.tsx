"use client";

import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/firebase";

export default function PrivacyPolicyPage() {
  const { user } = useUser();
  const backHref = user ? "/dashboard" : "/";
  const backLabel = user ? "Back to Dashboard" : "Back to Home";

  return (
    <div className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link href={backHref}>
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" /> {backLabel}
          </Button>
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-sm italic">Last Updated: March 2024</p>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">1. Introduction</h2>
            <p>
              Yebfa Consult ("we," "our," or "us") operates Yebfa ChurchHub. We are committed to protecting the privacy of our religious organizations ("Churches") and their members. This policy explains how we collect, use, and safeguard your data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">2. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Organizational Data:</strong> Church name, slug, denomination, and administrator emails.</li>
              <li><strong>Member Data:</strong> Names, phone numbers, dates of birth, and department affiliations provided by Church administrators or via public registration links.</li>
              <li><strong>Usage Data:</strong> SMS logs, attendance records, and financial transaction metadata for the purpose of generating reports and AI insights.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">3. Data Isolation</h2>
            <p>
              Yebfa ChurchHub uses a multi-tenant architecture. This means your church's data is logically separated from all other organizations. No other church or unauthorized person can access your member records, financial data, or attendance logs.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">4. Use of AI</h2>
            <p>
              Our Pastoral Insight Tool processes your church's anonymized attendance and financial trends to provide growth strategies. This data is processed securely and is never shared with other tenants.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">5. Contact Us</h2>
            <p>
              For privacy-related inquiries, please contact our system administrators at:
              <br />
              Email: asareg365@gmail.com | frankyeb@gmail.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
