"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Sidebar, MobileSidebar } from "@/components/layout/sidebar";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Lock, KeyRound } from "lucide-react";
import { Toaster, toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mustChangePassword, setMustChangePassword] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    useEffect(() => {
        if (!isAuthenticated()) {
            router.replace("/login");
        } else {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setChecking(false);
            if (localStorage.getItem("pwx_must_change_password") === "true") {
                setMustChangePassword(true);
            }
        }
    }, [router]);

    const handlePasswordChange = async () => {
        if (newPassword.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }
        setIsUpdatingPassword(true);
        try {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Password updated successfully!");
                localStorage.removeItem("pwx_must_change_password");
                setMustChangePassword(false);
            } else {
                toast.error(data.error || "Failed to update password");
            }
        } catch (e) {
            toast.error("Network error");
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    if (checking) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <TooltipProvider delayDuration={0}>
            <div className="flex h-screen bg-white">
                {/* Desktop sidebar */}
                <div className="hidden md:block">
                    <Sidebar
                        collapsed={sidebarCollapsed}
                        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
                    />
                </div>

                {/* Mobile top bar + sheet sidebar */}
                <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between bg-white/95 px-4 backdrop-blur-xl md:hidden">
                    <div className="flex items-center gap-2">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                                >
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent
                                side="left"
                                className="w-64 border-r border-neutral-200 bg-white p-0"
                            >
                                <MobileSidebar />
                            </SheetContent>
                        </Sheet>
                        <span className="ml-1 text-sm font-semibold text-neutral-900">
                            PWX Inventory
                        </span>
                    </div>
                    {/* Notification bell — mobile */}
                    <NotificationPanel />
                </div>

                {/* Main content */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    {/* Desktop top bar with notification bell */}
                    <div className="hidden md:flex h-12 shrink-0 items-center justify-end bg-white px-6">
                        <NotificationPanel />
                    </div>
                    <div className="flex-1 overflow-y-auto w-full">
                        <div className="mx-auto max-w-7xl p-6 lg:p-8 w-full">{children}</div>
                    </div>
                </main>
            </div>
            
            {/* Forced Password Change Modal */}
            <Dialog open={mustChangePassword}>
                <DialogContent className="sm:max-w-md [&>button.absolute.right-4.top-4]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-amber-500" />
                            Action Required: Update Password
                        </DialogTitle>
                        <DialogDescription>
                            For your security, you must set an initial active password before continuing to use the dashboard system.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="new-pwd" className="flex items-center gap-2">
                                <KeyRound className="h-4 w-4 text-neutral-400" />
                                New Password
                            </Label>
                            <Input 
                                id="new-pwd" 
                                type="password" 
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter at least 8 characters..." 
                            />
                        </div>
                    </div>
                    <Button onClick={handlePasswordChange} disabled={isUpdatingPassword} className="w-full bg-blue-600 hover:bg-blue-700">
                        {isUpdatingPassword ? "Updating..." : "Secure Account & Continue"}
                    </Button>
                </DialogContent>
            </Dialog>

            {/* Global toast provider */}
            <Toaster richColors position="top-right" />
        </TooltipProvider>
    );
}
