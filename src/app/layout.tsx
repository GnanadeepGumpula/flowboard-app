import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";
import DeveloperBadge from "@/components/DeveloperBadge";
import ClarityTracker from "@/components/ClarityTracker"; // <-- Import the new tracker

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flowboard",
  description: "Real-time Kanban project management for teams",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        {/* Inject Clarity Tracker here */}
        <ClarityTracker /> 
        
        <AppShell>
          {children}
          <DeveloperBadge />
        </AppShell>
        <Toaster />
      </body>
    </html>
  );
}