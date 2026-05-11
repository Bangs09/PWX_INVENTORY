"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Filter, Shield, MoreVertical, Trash2, Pencil, KeyRound, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AddUserDialog, UserAccount } from "./add_user";
import { useClientRole } from "@/lib/use-client-role";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuPortal,
    DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";

export default function UsersPage() {
    const router = useRouter();
    const { role, ready } = useClientRole();
    const [users, setUsers] = useState<UserAccount[]>([]);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<"All" | "Co-Admin" | "User">("All");
    const [loading, setLoading] = useState(true);
    const [resetTarget, setResetTarget] = useState<UserAccount | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        if (!ready) return;
        if (role !== "admin" && role !== "co-admin") {
            router.replace("/");
            return;
        }

        const fetchUsers = async () => {
            try {
                const res = await fetch("/api/users");
                if (res.ok) {
                    const data = await res.json();
                    const formattedData = data.map((u: any) => ({
                        ...u,
                        role: u.role === "co-admin" ? "Co-Admin" 
                              : u.role === "admin" ? "Admin" 
                              : "User"
                    }));
                    setUsers(formattedData);
                }
            } catch (err) {
                console.error("Failed to fetch users", err);
                toast.error("Failed to load users");
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [ready, role, router]);

    if (!ready || loading) return <div className="p-8 text-neutral-500">Loading users...</div>;
    if (role !== "admin" && role !== "co-admin") return null;

    const handleAddUser = async (newUser: UserAccount) => {
        const res = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...newUser,
                role: newUser.role === "Co-Admin" ? "co-admin" : "user"
            }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to create user");
        }

        const createdUser = await res.json();
        const formattedUser = {
            ...createdUser,
            role: createdUser.role === "co-admin" ? "Co-Admin"
                  : createdUser.role === "admin" ? "Admin"
                  : "User"
        };
        setUsers((prev) => [...prev, formattedUser]);
    };

    const handleDeleteUser = async (email: string) => {
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(email)}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete user");
            setUsers((prev) => prev.filter((u) => u.email !== email));
            toast.success("User deleted successfully");
        } catch (error) {
            toast.error("Failed to delete user");
        }
    };

    const handleEditRole = async (email: string, newRole: "admin" | "co-admin" | "user") => {
        if (email.toLowerCase() === "admin@packetworx.com") {
            toast.error("Cannot change the role of the System Admin");
            return;
        }

        const user = users.find((u) => u.email === email);
        if (!user) return;
        
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(email)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            });
            
            if (!res.ok) throw new Error("Failed to update role");
            
            const displayRole = newRole === "co-admin" ? "Co-Admin" : newRole === "admin" ? "Admin" : "User";

            setUsers((prev) =>
                prev.map((u) =>
                    u.email === email ? { ...u, role: displayRole as "Co-Admin" | "User" | "Admin" } : u
                )
            );
            toast.success("User role updated");
        } catch (error) {
            toast.error("Failed to update user role");
        }
    };

    const handleResetPassword = async () => {
        if (!resetTarget) return;
        if (newPassword.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }
        setIsResetting(true);
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(resetTarget.email)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "resetPassword", newPassword }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to reset password");
            }
            toast.success(`Password reset for ${resetTarget.name || resetTarget.email}`);
            setResetTarget(null);
            setNewPassword("");
        } catch (error: any) {
            toast.error(error.message || "Failed to reset password");
        } finally {
            setIsResetting(false);
        }
    };

    const filtered = users.filter((u) => {
        const matchesSearch =
            (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
            (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
            (u.role || "").toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === "All" || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
                        User Management
                    </h1>
                    <p className="mt-1 text-neutral-500">
                        Create accounts and manage user roles
                    </p>
                </div>
                <AddUserDialog onAdd={handleAddUser} />
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                        placeholder="Search users by name, role, or email..."
                        className="border-neutral-200 bg-white pl-9 text-neutral-900 placeholder:text-neutral-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className={`border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 ${
                                roleFilter !== "All" ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100" : ""
                            }`}
                        >
                            <Filter className="mr-2 h-4 w-4" />
                            {roleFilter === "All" ? "Filter Roles" : roleFilter}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 bg-white border-neutral-200 shadow-lg">
                        {(["All", "Co-Admin", "User"] as const).map((r) => (
                            <DropdownMenuItem
                                key={r}
                                onClick={() => setRoleFilter(r)}
                                className={`cursor-pointer text-sm ${
                                    roleFilter === r
                                        ? "bg-amber-50 text-amber-700 font-semibold"
                                        : "text-neutral-700 hover:bg-neutral-50"
                                }`}
                            >
                                {r === "All" ? "All Roles" : r}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Users List */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((user, index) => (
                    <Card
                        key={`${user.email}-${index}`}
                        className="border-neutral-200 bg-white shadow-sm transition-all hover:border-neutral-300 hover:shadow-md"
                    >
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                                    <Users className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="flex gap-2">
                                    <Badge
                                        variant="secondary"
                                        className={
                                            user.role === "Admin"
                                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                                : user.role === "Co-Admin"
                                                    ? "border-violet-200 bg-violet-50 text-violet-700"
                                                    : "border-blue-200 bg-blue-50 text-blue-700"
                                        }
                                    >
                                        {(user.role === "Admin" || user.role === "Co-Admin") && <Shield className="mr-1 h-3 w-3" />}
                                        {user.role}
                                    </Badge>
                                </div>
                            </div>
                            <CardTitle className="mt-4 text-lg text-neutral-900">{user.name}</CardTitle>
                            <CardDescription className="text-neutral-500">
                                {user.email}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between mt-2 pt-4 border-t border-neutral-100">
                                <Badge
                                    variant="outline"
                                    className={
                                        user.status === "Active"
                                            ? "border-emerald-200 text-emerald-600"
                                            : "border-neutral-200 text-neutral-500"
                                    }
                                >
                                    <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
                                    {user.status}
                                </Badge>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-neutral-900">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 bg-white border-neutral-200 shadow-lg">
                                        {user.email.toLowerCase() !== "admin@packetworx.com" && (
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer hover:bg-neutral-50 focus:bg-neutral-50">
                                                    <Pencil className="h-3.5 w-3.5 text-neutral-500" />
                                                    Edit Role
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuPortal>
                                                    <DropdownMenuSubContent className="bg-white border-neutral-200 shadow-lg min-w-[120px]">
                                                        <DropdownMenuItem onClick={() => handleEditRole(user.email, "admin")} className="cursor-pointer text-sm">Admin</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleEditRole(user.email, "co-admin")} className="cursor-pointer text-sm">Co-Admin</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleEditRole(user.email, "user")} className="cursor-pointer text-sm">User</DropdownMenuItem>
                                                    </DropdownMenuSubContent>
                                                </DropdownMenuPortal>
                                            </DropdownMenuSub>
                                        )}
                                        {role === "admin" && (
                                            <>
                                                {user.email.toLowerCase() !== "admin@packetworx.com" && (
                                                    <DropdownMenuSeparator className="bg-neutral-100" />
                                                )}
                                                <DropdownMenuItem
                                                    className="flex items-center gap-2 text-sm text-amber-700 cursor-pointer hover:bg-amber-50 focus:bg-amber-50"
                                                    onClick={() => { setResetTarget(user); setNewPassword(""); setShowPassword(false); }}
                                                >
                                                    <KeyRound className="h-3.5 w-3.5" />
                                                    Reset Password
                                                </DropdownMenuItem>
                                                {user.email.toLowerCase() !== "admin@packetworx.com" && (
                                                    <>
                                                        <DropdownMenuSeparator className="bg-neutral-100" />
                                                        <DropdownMenuItem
                                                            className="flex items-center gap-2 text-sm text-red-600 cursor-pointer hover:bg-red-50 focus:bg-red-50"
                                                            onClick={() => handleDeleteUser(user.email)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                            Delete User
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ── Reset Password Dialog ── */}
            <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) { setResetTarget(null); setNewPassword(""); } }}>
                <DialogContent className="sm:max-w-[400px] bg-white text-black rounded-2xl border border-neutral-200 shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-neutral-100 bg-amber-50/40">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                                <KeyRound className="h-5 w-5 text-amber-700" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-neutral-900">Reset Password</DialogTitle>
                                <DialogDescription className="text-xs text-neutral-500 mt-0.5">
                                    Set a new password for <span className="font-semibold text-neutral-700">{resetTarget?.name || resetTarget?.email}</span>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="px-6 py-5 space-y-3">
                        <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest">New Password</label>
                        <div className="relative">
                            <Input
                                id="reset-password-input"
                                type={showPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min. 8 characters"
                                className="h-11 pr-11 rounded-xl border-neutral-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 font-medium text-sm"
                                onKeyDown={(e) => { if (e.key === "Enter") handleResetPassword(); }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <p className="text-[11px] text-neutral-400">The user will be required to change this password on next login.</p>
                    </div>
                    <DialogFooter className="px-6 pb-6 flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => { setResetTarget(null); setNewPassword(""); }}
                            className="flex-1 h-10 rounded-xl border-neutral-200 text-neutral-600"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleResetPassword}
                            disabled={isResetting || newPassword.length < 8}
                            className="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm"
                        >
                            {isResetting ? "Resetting..." : "Reset Password"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
