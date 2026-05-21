"use client";

import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background py-20 px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link href="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Scale className="w-6 h-6" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-sm italic">Last Updated: March 2024</p>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By registering your ministry on Yebfa ChurchHub, you agree to comply with and be bound by these terms. These terms apply to all administrators and users of the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">2. Subscription & Payments</h2>
            <p>
              Yebfa ChurchHub operates on a monthly subscription model. To activate or renew your plan:
            </p>
            <ul className="list-disc pl-6 space-y-2 font-medium text-foreground">
              <li>Payments must be made via Mobile Money to <strong>0248472474</strong>.</li>
              <li>You must use your <strong>Church Name</strong> as the transaction reference.</li>
              <li>Credits and account activation are typically processed within 1 hour of payment verification.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">3. SMS Credits</h2>
            <p>
              SMS credits are deducted from your balance upon successful delivery. If your credit balance reaches zero, automated messaging (including Birthday SMS) will be suspended until a recharge is performed.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">4. Responsible Use</h2>
            <p>
              Administrators are responsible for all content sent via bulk SMS. You agree not to send spam, offensive content, or unauthorized communications to your congregation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">5. Termination</h2>
            <p>
              We reserve the right to suspend accounts for non-payment or violation of these terms. Organizations can request data exports before closing an account.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
