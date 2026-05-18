
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { Footer } from "@/components/dashboard/Footer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-72 p-4 flex flex-col">
        <Header />
        <div className="flex-1">
          {children}
        </div>
        <Footer />
      </main>
    </div>
  );
}
