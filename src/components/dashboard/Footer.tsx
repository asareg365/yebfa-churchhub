
export function Footer() {
  return (
    <footer className="mt-auto py-8 px-8 border-t border-white/5">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm text-muted-foreground font-medium">
          © Yebfa Consult 2026
        </p>
        <div className="flex items-center gap-6">
          <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">Privacy Policy</a>
          <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">Terms of Service</a>
          <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">Support</a>
        </div>
      </div>
    </footer>
  );
}
