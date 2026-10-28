import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Tech Mystery Hunt – The Missing Code | TechFest 2026",
  description:
    "An immersive QR-code-based treasure hunt game for college TechFest. Decode clues, visit checkpoints, scan QR codes, and race for physical treasure boxes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-background text-slate-100 scanline-grid antialiased">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="border-t border-surface-border bg-surface-200/80 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="font-mono text-slate-400">
              Tech Mystery Hunt – <span className="text-cipher-cyan">The Missing Code</span>
            </div>
            <div>Official College TechFest Event Engine • MongoDB Atlas & Mongoose Architecture</div>
            <div className="text-slate-500 font-mono">Status: Secure Sandbox Node</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
