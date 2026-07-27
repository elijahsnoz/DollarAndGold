"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/misc";
import { WorkspaceProvider } from "@/lib/workspace/store";

/** Every client-side provider the app needs, mounted once at the root. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <WorkspaceProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className:
                "glass !rounded-2xl !border-white/10 !bg-card/90 !text-foreground",
            }}
          />
        </TooltipProvider>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
