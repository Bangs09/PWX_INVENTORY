"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    LayoutGrid,
    List,
    MoreVertical,
    Pencil,
    Copy,
    Archive,
    Trash2,
    FileStack,
    Plus,
    Search,
    Filter,
    ArrowLeft,
    Factory,
    Layers,
    Calendar,
    User,
    Tag,
    FlaskConical,
    CircleDollarSign,
    Target,
    Check,
    X,
    Download,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/format-currency";
import {
    type BOMEntry,
    defaultBOMs,
    mapRawToEntry,
    fetchBOMsFromServer,
    fetchBOMByIdFromServer,
    saveBOMToServer,
    submitBOMForApprovalOnServer,
    approveBOMOnServer,
    rejectBOMOnServer,
    archiveBOMOnServer,
    deleteBOMOnServer,
} from "./bom-storage";
import { useClientRole } from "@/lib/use-client-role";
import { exportBOMToExcel } from "@/lib/excel-import";
import { toast } from "sonner";

export type BOMManagementVariant = "main" | "archived";

const getHeaderGradientStyle = (status: string) => {
    if (status === "Approved") return "from-emerald-50/40 via-white to-neutral-50/40 border-emerald-100/50";
    if (status === "Pending Approval") return "from-amber-50/40 via-white to-neutral-50/40 border-amber-100/50";
    if (status === "Rejected") return "from-rose-50/40 via-white to-neutral-50/40 border-rose-100/50";
    return "from-blue-50/30 via-white to-neutral-50/40 border-blue-100/50";
};

const getHeaderIconBgStyle = (status: string) => {
    if (status === "Approved") return "from-emerald-100 to-teal-100 ring-emerald-200/50 text-emerald-700";
    if (status === "Pending Approval") return "from-amber-100 to-orange-100 ring-amber-200/50 text-amber-700";
    if (status === "Rejected") return "from-rose-100 to-red-100 ring-rose-200/50 text-rose-700";
    return "from-blue-100 to-indigo-100 ring-blue-200/50 text-blue-700";
};

const getStatusCardStyle = (status: string) => {
    if (status === "Approved") return "border-emerald-200/80 bg-emerald-50/30 text-emerald-800 shadow-[0_2px_8px_rgba(16,185,129,0.04)]";
    if (status === "Pending Approval") return "border-amber-200/80 bg-amber-50/30 text-amber-800 shadow-[0_2px_8px_rgba(245,158,11,0.04)]";
    if (status === "Draft") return "border-blue-200/80 bg-blue-50/30 text-blue-800 shadow-[0_2px_8px_rgba(59,130,246,0.04)]";
    if (status === "Rejected") return "border-rose-200/80 bg-rose-50/30 text-rose-800 shadow-[0_2px_8px_rgba(244,63,94,0.04)]";
    return "border-neutral-200 bg-neutral-50/30 text-neutral-800";
};

const getStatusIconColor = (status: string) => {
    if (status === "Approved") return "text-emerald-600";
    if (status === "Pending Approval") return "text-amber-600";
    if (status === "Draft") return "text-blue-600";
    if (status === "Rejected") return "text-rose-600";
    return "text-neutral-600";
};

export function BOMManagementInner({
    variant,
}: {
    variant: BOMManagementVariant;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [selectedBOM, setSelectedBOM] = useState<BOMEntry | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [allBOMs, setAllBOMs] = useState<BOMEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<BOMEntry | null>(null);

    // Role-gating states
    const { role } = useClientRole();
    const isAdmin = role === "admin" || role === "co-admin";

    // Rejection state
    const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
    const [rejectRemarks, setRejectRemarks] = useState("");

    // Inventory local cache for stock check preview
    const [inventoryCatalog, setInventoryCatalog] = useState<any[]>([]);

    const [statusFilter, setStatusFilter] = useState<Set<string>>(
        new Set(variant === "main" ? ["Draft", "Pending Approval", "Approved", "Rejected"] : ["Archived"])
    );
    const [phaseFilter, setPhaseFilter] = useState<Set<string>>(new Set());

    const basePath = "/bom";

    const visibleBOMs = useMemo(() => {
        return allBOMs.filter((b) => {
            const matchesStatus = statusFilter.size === 0 || statusFilter.has(b.status);
            const matchesPhase = phaseFilter.size === 0 || (b.phase && phaseFilter.has(b.phase));
            return matchesStatus && matchesPhase;
        });
    }, [allBOMs, statusFilter, phaseFilter]);

    const archivedCount = useMemo(
        () => allBOMs.filter((b) => b.status === "Archived").length,
        [allBOMs]
    );

    const displayedBOM = useMemo(() => {
        if (!selectedBOM) return null;
        const listBom = allBOMs.find((b) => b.id === selectedBOM.id);
        if (!listBom) return selectedBOM;
        return {
            ...selectedBOM,
            ...listBom,
            componentRows: selectedBOM.componentRows || listBom.componentRows,
        };
    }, [selectedBOM, allBOMs]);

    // Fetch BOMs from server
    const loadBOMs = useCallback(async () => {
        setIsLoading(true);
        try {
            const boms = await fetchBOMsFromServer();
            setAllBOMs(boms);
        } catch (error: any) {
            console.error("Failed to load BOMs:", error);
            toast.error(error.message || "Failed to load BOMs");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load inventory components catalog for stock validation preview
    const fetchInventoryCatalog = useCallback(async () => {
        try {
            const res = await fetch("/api/inventory/components");
            if (res.ok) {
                const data = await res.json();
                setInventoryCatalog(data);
            }
        } catch (error) {
            console.error("Failed to load inventory for check:", error);
        }
    }, []);

    useEffect(() => {
        loadBOMs();
    }, [loadBOMs]);

    useEffect(() => {
        if (sheetOpen) {
            fetchInventoryCatalog();
        }
    }, [sheetOpen, fetchInventoryCatalog]);

    // Handle real-time updates via SSE
    useEffect(() => {
        if (typeof window === "undefined" || !window.EventSource) return;
        const es = new EventSource("/api/stock-requests/stream");
        const onRefresh = () => {
            loadBOMs();
            if (selectedBOM) {
                fetchBOMByIdFromServer(selectedBOM.id)
                    .then((updated) => setSelectedBOM(updated))
                    .catch((err) => console.error("Error refreshing selected BOM on SSE:", err));
            }
        };
        es.addEventListener("refresh", onRefresh);
        return () => {
            es.removeEventListener("refresh", onRefresh);
            es.close();
        };
    }, [loadBOMs, selectedBOM]);

    const handleRowClick = useCallback(async (bom: BOMEntry) => {
        setSelectedBOM(bom);
        setSheetOpen(true);
        try {
            const fullBOM = await fetchBOMByIdFromServer(bom.id);
            setSelectedBOM(fullBOM);
        } catch (error: any) {
            console.error("Failed to load BOM details:", error);
            toast.error(error.message || "Failed to load BOM details");
        }
    }, []);

    // Deep link ?bom=<id>
    useEffect(() => {
        const id = searchParams.get("bom");
        if (id && allBOMs.length > 0) {
            const bom = allBOMs.find((b) => b.id === id);
            if (bom) {
                handleRowClick(bom);
            }
            router.replace(basePath, { scroll: false });
        }
    }, [searchParams, allBOMs, router, basePath, handleRowClick]);

    const getInventoryImpactForSku = useCallback((sku: string, requiredQty: number) => {
        const normSku = sku.toUpperCase().trim();
        const matches = inventoryCatalog.filter(c => 
            c.sku?.toUpperCase().trim() === normSku && 
            (c.warehouse?.toUpperCase()?.startsWith("PWX") || c.warehouse === "PWX IoT Hub")
        );

        if (matches.length === 0) {
            return {
                sufficient: false,
                totalAvailable: 0,
                breakdown: [],
                notFound: true
            };
        }

        const totalAvailable = matches.reduce((sum, m) => sum + (m.stock || 0), 0);
        const sufficient = matches.some(m => (m.stock || 0) >= requiredQty);

        return {
            sufficient,
            totalAvailable,
            breakdown: matches.map(m => ({ warehouse: m.warehouse, stock: m.stock })),
            notFound: false
        };
    }, [inventoryCatalog]);

    const canDelete = (status: string) => {
        return status === "Draft" || status === "Rejected" || status === "Archived";
    };

    const canArchive = (status: string) => {
        return status !== "Pending Approval";
    };

    // ─── Row Actions ─────────────────────────────────────────────────
    const handleEdit = useCallback((bom: BOMEntry) => {
        if (bom.status !== "Draft" && bom.status !== "Rejected") {
            toast.error("Only Draft or Rejected BOMs can be edited.");
            return;
        }
        router.push("/bom/create?edit=" + bom.id);
    }, [router]);

    const handleExportExcel = useCallback(async (bom: BOMEntry) => {
        const toastId = toast.loading(`Preparing export for ${bom.id}...`);
        try {
            const fullBOM = await fetchBOMByIdFromServer(bom.id);
            if (!fullBOM.componentRows || fullBOM.componentRows.length === 0) {
                toast.error("This BOM has no component lines to export.", { id: toastId });
                return;
            }
            exportBOMToExcel(fullBOM);
            toast.success("BOM exported to Excel successfully.", { id: toastId });
        } catch (error: any) {
            console.error("Failed to export BOM:", error);
            toast.error(error.message || "Failed to export BOM", { id: toastId });
        }
    }, []);

    const handleDuplicate = useCallback(async (bom: BOMEntry) => {
        try {
            const fullBOM = await fetchBOMByIdFromServer(bom.id);
            const newId = `BOM-${Date.now().toString().slice(-4)}`;
            const duplicate: Partial<BOMEntry> = {
                id: newId,
                name: `${bom.name} (Copy)`,
                cpn: fullBOM.cpn,
                revision: fullBOM.revision,
                phase: fullBOM.phase,
                targetQty: fullBOM.targetQty,
                description: fullBOM.description,
                componentRows: fullBOM.componentRows,
                totalCost: fullBOM.totalCost,
                status: "Draft",
            };
            await saveBOMToServer(duplicate);
            toast.success("BOM duplicated successfully as Draft.");
            loadBOMs();
        } catch (error: any) {
            console.error("Failed to duplicate BOM:", error);
            toast.error(error.message || "Failed to duplicate BOM");
        }
    }, [loadBOMs]);

    const handleArchive = useCallback(async (bom: BOMEntry) => {
        if (bom.status === "Pending Approval") {
            toast.error("Pending Approval BOMs cannot be archived.");
            return;
        }
        try {
            const updated = await archiveBOMOnServer(bom.id);
            toast.success(`BOM status updated to ${updated.status}.`);
            loadBOMs();
            if (selectedBOM?.id === bom.id) {
                setSelectedBOM(updated);
            }
        } catch (error: any) {
            console.error("Failed to archive BOM:", error);
            toast.error(error.message || "Failed to archive BOM");
        }
    }, [loadBOMs, selectedBOM]);

    const handleDeleteConfirm = useCallback(async () => {
        if (!deleteTarget) return;
        if (deleteTarget.status === "Pending Approval" || deleteTarget.status === "Approved") {
            toast.error("Approved and Pending BOMs cannot be deleted.");
            setDeleteTarget(null);
            return;
        }
        try {
            await deleteBOMOnServer(deleteTarget.id);
            toast.success("BOM deleted successfully.");
            const removedId = deleteTarget.id;
            setDeleteTarget(null);
            loadBOMs();
            if (selectedBOM?.id === removedId) {
                setSheetOpen(false);
                setSelectedBOM(null);
            }
        } catch (error: any) {
            console.error("Failed to delete BOM:", error);
            toast.error(error.message || "Failed to delete BOM");
            setDeleteTarget(null);
        }
    }, [deleteTarget, loadBOMs, selectedBOM]);

    const handleSubmit = useCallback(async (id: string) => {
        try {
            const updated = await submitBOMForApprovalOnServer(id);
            toast.success("BOM submitted for approval successfully!");
            loadBOMs();
            if (selectedBOM?.id === id) {
                setSelectedBOM(updated);
            }
        } catch (error: any) {
            console.error("Failed to submit BOM:", error);
            toast.error(error.message || "Failed to submit BOM");
        }
    }, [loadBOMs, selectedBOM]);

    const handleApprove = useCallback(async (id: string) => {
        try {
            const updated = await approveBOMOnServer(id);
            toast.success("BOM approved! Component inventory has been deducted.");
            loadBOMs();
            if (selectedBOM?.id === id) {
                setSelectedBOM(updated);
            }
        } catch (error: any) {
            console.error("Failed to approve BOM:", error);
            toast.error(error.message || "Failed to approve BOM");
        }
    }, [loadBOMs, selectedBOM]);

    const handleRejectSubmit = useCallback(async () => {
        if (!rejectTargetId) return;
        if (!rejectRemarks.trim()) {
            toast.error("Rejection remarks are required.");
            return;
        }
        try {
            const updated = await rejectBOMOnServer(rejectTargetId, rejectRemarks);
            toast.success("BOM has been rejected.");
            setRejectTargetId(null);
            setRejectRemarks("");
            loadBOMs();
            if (selectedBOM?.id === rejectTargetId) {
                setSelectedBOM(updated);
            }
        } catch (error: any) {
            console.error("Failed to reject BOM:", error);
            toast.error(error.message || "Failed to reject BOM");
        }
    }, [rejectTargetId, rejectRemarks, loadBOMs, selectedBOM]);

    const getStatusBadgeVariant = (status: string) => {
        if (status === "Approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
        if (status === "Pending Approval") return "border-amber-200 bg-amber-50 text-amber-700";
        if (status === "Draft") return "border-blue-200 bg-blue-50 text-blue-700";
        if (status === "Rejected") return "border-rose-200 bg-rose-50 text-rose-700";
        return "border-neutral-200 bg-neutral-100 text-neutral-600";
    };

    const handleSheetEdit = useCallback(() => {
        if (!displayedBOM) return;
        handleEdit(displayedBOM);
        setSheetOpen(false);
    }, [displayedBOM, handleEdit]);

    const handleSheetArchive = useCallback(() => {
        if (!displayedBOM) return;
        handleArchive(displayedBOM);
    }, [displayedBOM, handleArchive]);

    const handleSheetDuplicate = useCallback(() => {
        if (!displayedBOM) return;
        handleDuplicate(displayedBOM);
    }, [displayedBOM, handleDuplicate]);

    const handleSheetExportExcel = useCallback(() => {
        if (!displayedBOM) return;
        handleExportExcel(displayedBOM);
    }, [displayedBOM, handleExportExcel]);

    const COMPONENT_PREVIEW_LIMIT = 10;

    const componentLineCount = displayedBOM
        ? displayedBOM.componentRows?.length ?? displayedBOM.components
        : 0;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
                        Bill of Materials
                    </h1>
                    <p className="mt-1 text-neutral-500">
                        Manage active and draft BOMs. Use filters to view archived revisions.
                    </p>
                </div>
                {variant === "main" ? (
                    <Link href="/bom/create">
                        <Button className="bg-neutral-950 hover:bg-neutral-800 text-white shadow-md transition-colors">
                            <Plus className="mr-2 h-4 w-4" />
                            Create BOM
                        </Button>
                    </Link>
                ) : null}
            </div>

            {/* Search, Filters, and View Toggle */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                        <Input
                            placeholder="Search bills of materials..."
                            className="border-neutral-200 bg-white pl-9 text-neutral-900 placeholder:text-neutral-500"
                        />
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">
                                <Filter className="mr-2 h-4 w-4" />
                                Filter {(statusFilter.size > 0 || phaseFilter.size > 0) ? " (Active)" : ""}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px] p-2">
                            <DropdownMenuLabel className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Status</DropdownMenuLabel>
                            {["Active", "Draft", "Archived"].map((st) => (
                                <div key={st} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-neutral-50 rounded-sm cursor-pointer" onClick={() => {
                                    setStatusFilter(prev => {
                                        const next = new Set(prev);
                                        if (next.has(st)) next.delete(st);
                                        else next.add(st);
                                        return next;
                                    });
                                }}>
                                    <input type="checkbox" checked={statusFilter.has(st)} readOnly className="pointer-events-none rounded border-neutral-300 text-amber-600 focus:ring-amber-500" />
                                    <span className="text-sm font-medium text-neutral-700">{st}</span>
                                </div>
                            ))}
                            <DropdownMenuSeparator className="my-2" />
                            <DropdownMenuLabel className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Phase</DropdownMenuLabel>
                            {["Prototype", "Pre-Production", "Production", "End of Life"].map((ph) => (
                                <div key={ph} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-neutral-50 rounded-sm cursor-pointer" onClick={() => {
                                    setPhaseFilter(prev => {
                                        const next = new Set(prev);
                                        if (next.has(ph)) next.delete(ph);
                                        else next.add(ph);
                                        return next;
                                    });
                                }}>
                                    <input type="checkbox" checked={phaseFilter.has(ph)} readOnly className="pointer-events-none rounded border-neutral-300 text-amber-600 focus:ring-amber-500" />
                                    <span className="text-sm font-medium text-neutral-700">{ph}</span>
                                </div>
                            ))}
                            <div className="mt-2 pt-2 border-t border-neutral-100 flex justify-end">
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setStatusFilter(new Set()); setPhaseFilter(new Set()); }}>Clear all</Button>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                {/* View Toggle */}
                <div className="flex items-center rounded-md border border-neutral-200 bg-white p-1 shadow-sm">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode("grid")}
                        className={`px-3 py-1.5 h-8 ${viewMode === "grid" ? "bg-neutral-100 text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
                    >
                        <LayoutGrid className="mr-2 h-4 w-4" />
                        Grid
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode("table")}
                        className={`px-3 py-1.5 h-8 ${viewMode === "table" ? "bg-neutral-100 text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
                    >
                        <List className="mr-2 h-4 w-4" />
                        Table
                    </Button>
                </div>
            </div>

            {visibleBOMs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-16 text-center">
                    <FileStack className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
                    <p className="text-sm font-medium text-neutral-700">
                        No BOMs found
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-xs text-neutral-500">
                        Try adjusting your search or filter settings, or create a new BOM.
                    </p>
                    {variant === "main" ? (
                        <Button
                            asChild
                            className="mt-4 bg-neutral-950 hover:bg-neutral-800 text-white transition-colors"
                        >
                            <Link href="/bom/create">Create BOM</Link>
                        </Button>
                    ) : null}
                </div>
            ) : (
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    {viewMode === "grid" ? (
                        /* Grid Layout */
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {visibleBOMs.map((bom) => (
                                <Card key={bom.id} className="border-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow group relative cursor-pointer" onClick={() => handleRowClick(bom)}>
                                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                                                <FileStack className="h-5 w-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base font-semibold text-neutral-900 line-clamp-1">{bom.name}</CardTitle>
                                                <CardDescription className="text-xs text-neutral-500 mt-1">{bom.id}</CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className={getStatusBadgeVariant(bom.status)}>
                                                {bom.status}
                                            </Badge>
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-900 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-[160px]">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleEdit(bom)} disabled={bom.status === "Approved" || bom.status === "Pending Approval"}><Pencil className="mr-2 h-3.5 w-3.5" /> Edit BOM</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDuplicate(bom)}><Copy className="mr-2 h-3.5 w-3.5" /> Duplicate</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleArchive(bom)} disabled={bom.status === "Pending Approval"}><Archive className="mr-2 h-3.5 w-3.5" /> {bom.status === "Archived" ? "Unarchive" : "Archive"}</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleExportExcel(bom)}><Download className="mr-2 h-3.5 w-3.5" /> Export Excel</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600" onClick={() => setDeleteTarget(bom)} disabled={bom.status === "Approved" || bom.status === "Pending Approval"}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="mt-4 grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                                            <div>
                                                <p className="text-neutral-500 text-xs mb-1">Revision</p>
                                                <p className="font-medium text-neutral-900">{bom.revision}</p>
                                            </div>
                                            <div>
                                                <p className="text-neutral-500 text-xs mb-1">Components</p>
                                                <p className="font-medium text-neutral-900">{bom.components}</p>
                                            </div>
                                            <div>
                                                <p className="text-neutral-500 text-xs mb-1">Phase</p>
                                                <p className="font-medium text-neutral-900 truncate">{bom.phase || "—"}</p>
                                            </div>
                                            <div>
                                                <p className="text-neutral-500 text-xs mb-1">Last Modified</p>
                                                <p className="font-medium text-neutral-900">{bom.lastModified}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        /* Table Layout */
                        <Card className="border-neutral-200 bg-white shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-neutral-50/50">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[300px]">Name & ID</TableHead>
                                            <TableHead>Revision</TableHead>
                                            <TableHead>Components</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Phase</TableHead>
                                            <TableHead>Last Modified</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {visibleBOMs.map((bom) => (
                                            <TableRow key={bom.id} className="cursor-pointer hover:bg-neutral-50/50 transition-colors" onClick={() => handleRowClick(bom)}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50">
                                                            <FileStack className="h-4 w-4 text-amber-600" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-neutral-900">{bom.name}</p>
                                                            <p className="text-xs text-neutral-500">{bom.id}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-neutral-600">{bom.revision}</TableCell>
                                                <TableCell className="text-neutral-600">{bom.components}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={getStatusBadgeVariant(bom.status)}>
                                                        {bom.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-neutral-600">
                                                    {bom.phase || "—"}
                                                </TableCell>
                                                <TableCell className="text-neutral-600">
                                                    <p className="text-sm">{bom.lastModified}</p>
                                                    <p className="text-xs text-neutral-400">{bom.author}</p>
                                                </TableCell>
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0 text-neutral-500 hover:text-neutral-900">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-[160px]">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleEdit(bom)} disabled={bom.status === "Approved" || bom.status === "Pending Approval"}><Pencil className="mr-2 h-3.5 w-3.5" /> Edit BOM</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleDuplicate(bom)}><Copy className="mr-2 h-3.5 w-3.5" /> Duplicate</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleArchive(bom)} disabled={bom.status === "Pending Approval"}><Archive className="mr-2 h-3.5 w-3.5" /> {bom.status === "Archived" ? "Unarchive" : "Archive"}</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleExportExcel(bom)}><Download className="mr-2 h-3.5 w-3.5" /> Export Excel</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600" onClick={() => setDeleteTarget(bom)} disabled={bom.status === "Approved" || bom.status === "Pending Approval"}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    )}

                    <SheetContent className="flex h-full w-[min(100vw-1rem,36rem)] flex-col gap-0 overflow-hidden border-l border-neutral-200/80 bg-white p-0 shadow-2xl sm:max-w-lg lg:max-w-xl xl:max-w-2xl">
                        <SheetHeader className={`shrink-0 space-y-0 border-b border-neutral-200/80 p-6 pb-5 pr-14 transition-all duration-500 ${getHeaderGradientStyle(displayedBOM?.status ?? "")}`}>
                            <div className="flex items-start gap-4">
                                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ring-1 transition-all duration-500 ${getHeaderIconBgStyle(displayedBOM?.status ?? "")}`}>
                                    <FileStack className="h-7 w-7" />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                    <SheetTitle className="text-2xl font-semibold leading-tight tracking-tight text-neutral-900">
                                        {displayedBOM?.name ?? "Bill of materials"}
                                    </SheetTitle>
                                    <SheetDescription className="font-mono text-sm text-neutral-500">
                                        {displayedBOM
                                            ? `${displayedBOM.id} · ${displayedBOM.revision}`
                                            : "Select a BOM from the list"}
                                    </SheetDescription>
                                </div>
                            </div>

                            {displayedBOM ? (
                                <div className="mt-5 grid grid-cols-2 gap-3">
                                    {/* Card 1: Status */}
                                    <div className={`rounded-2xl border p-3 shadow-sm backdrop-blur-sm transition-all duration-300 ${getStatusCardStyle(displayedBOM.status)}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`p-1 rounded-md bg-white/80 border border-current/10 shadow-sm ${getStatusIconColor(displayedBOM.status)}`}>
                                                <FileStack className="h-3.5 w-3.5" />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                                                Status
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-1 pl-1.5">
                                            <span className="text-sm font-extrabold tracking-wide truncate">
                                                {displayedBOM.status}
                                            </span>
                                            {displayedBOM.status === "Pending Approval" && (
                                                <span className="relative flex h-1.5 w-1.5 shrink-0">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                                </span>
                                            )}
                                            {displayedBOM.status === "Approved" && (
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Card 2: Lines */}
                                    <div className="rounded-2xl border border-neutral-200/60 bg-white/70 p-3 shadow-sm backdrop-blur-sm hover:shadow-md transition-all duration-300">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-1 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200/40">
                                                <Layers className="h-3.5 w-3.5" />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                                Lines
                                            </span>
                                        </div>
                                        <p className="text-sm font-extrabold tabular-nums text-neutral-900 pl-1.5">
                                            {componentLineCount}
                                        </p>
                                    </div>

                                    {/* Card 3: Revision */}
                                    <div className="rounded-2xl border border-neutral-200/60 bg-white/70 p-3 shadow-sm backdrop-blur-sm hover:shadow-md transition-all duration-300">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-1 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200/40">
                                                <Tag className="h-3.5 w-3.5" />
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                                Revision
                                            </span>
                                        </div>
                                        <p className="text-sm font-extrabold text-neutral-900 pl-1.5 truncate">
                                            {displayedBOM.revision}
                                        </p>
                                    </div>

                                    {/* Card 4: Phase / Updated */}
                                    <div className="rounded-2xl border border-neutral-200/60 bg-white/70 p-3 shadow-sm backdrop-blur-sm hover:shadow-md transition-all duration-300">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-1 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200/40">
                                                {displayedBOM.phase ? (
                                                    <FlaskConical className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Calendar className="h-3.5 w-3.5" />
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                                {displayedBOM.phase ? "Phase" : "Updated"}
                                            </span>
                                        </div>
                                        <p className="text-sm font-extrabold text-neutral-900 pl-1.5 truncate">
                                            {displayedBOM.phase ?? displayedBOM.lastModified}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </SheetHeader>

                        <Tabs
                            key={displayedBOM?.id ?? "none"}
                            defaultValue="overview"
                            className="flex min-h-0 flex-1 flex-col"
                        >
                            <TabsList
                                variant="line"
                                className="h-auto w-full shrink-0 justify-start gap-0 rounded-none border-b border-neutral-200 bg-transparent p-0 px-6 pt-1"
                            >
                                <TabsTrigger
                                    value="overview"
                                    className="rounded-none border-0 border-b-2 border-transparent px-1 py-3 text-sm data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:hidden"
                                >
                                    Overview
                                </TabsTrigger>
                                <TabsTrigger
                                    value="components"
                                    className="rounded-none border-0 border-b-2 border-transparent px-1 py-3 text-sm data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:hidden"
                                >
                                    Components ({componentLineCount})
                                </TabsTrigger>
                                {isAdmin && displayedBOM?.status === "Approved" && (
                                    <TabsTrigger
                                        value="transactions"
                                        className="rounded-none border-0 border-b-2 border-transparent px-1 py-3 text-sm data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:hidden"
                                    >
                                        Transaction Logs
                                    </TabsTrigger>
                                )}
                            </TabsList>

                            <TabsContent
                                value="overview"
                                className="min-h-0 flex-1 overflow-y-auto px-6 py-6 focus-visible:outline-none"
                            >
                                <div className="space-y-6">
                                    {displayedBOM &&
                                        ((displayedBOM.totalCost !== undefined &&
                                            displayedBOM.totalCost > 0) ||
                                            displayedBOM.targetQty !== undefined) ? (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {displayedBOM.totalCost !== undefined &&
                                                displayedBOM.totalCost > 0 ? (
                                                <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/80 p-4">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200/80">
                                                        <CircleDollarSign className="h-5 w-5 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                                            Roll-up cost
                                                        </p>
                                                        <p className="text-lg font-semibold text-neutral-900">
                                                            {formatCurrency(
                                                                displayedBOM.totalCost
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : null}
                                            {displayedBOM.targetQty !== undefined ? (
                                                <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/80 p-4">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-neutral-200/80">
                                                        <Target className="h-5 w-5 text-amber-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                                                            Target qty
                                                        </p>
                                                        <p className="text-lg font-semibold text-neutral-900">
                                                            {displayedBOM.targetQty}
                                                            {displayedBOM.assemblyUom
                                                                ? ` ${displayedBOM.assemblyUom}`
                                                                : ""}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    <div>
                                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                            Record
                                        </h4>
                                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div className="flex gap-3 rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
                                                <User className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                                                <div>
                                                    <dt className="text-xs text-neutral-500">
                                                        Author
                                                    </dt>
                                                    <dd className="mt-0.5 font-medium text-neutral-900">
                                                        {displayedBOM?.author ?? "—"}
                                                    </dd>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
                                                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                                                <div>
                                                    <dt className="text-xs text-neutral-500">
                                                        Last modified
                                                    </dt>
                                                    <dd className="mt-0.5 font-medium text-neutral-900">
                                                        {displayedBOM?.lastModified ??
                                                            "—"}
                                                    </dd>
                                                </div>
                                            </div>
                                            {displayedBOM?.cpn ? (
                                                <div className="sm:col-span-2 flex gap-3 rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
                                                    <Tag className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                                                    <div>
                                                        <dt className="text-xs text-neutral-500">
                                                            CPN
                                                        </dt>
                                                        <dd className="mt-0.5 font-mono text-sm font-medium text-neutral-900">
                                                            {displayedBOM.cpn}
                                                        </dd>
                                                    </div>
                                                </div>
                                            ) : null}
                                            {displayedBOM?.submittedBy && (
                                                <div className="sm:col-span-2 flex gap-3 rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
                                                    <User className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                                                    <div>
                                                        <dt className="text-xs text-neutral-500">
                                                            Submitted By
                                                        </dt>
                                                        <dd className="mt-0.5 font-medium text-neutral-900">
                                                            {displayedBOM.submittedBy} {displayedBOM.submittedAt ? `at ${new Date(displayedBOM.submittedAt).toLocaleString()}` : ""}
                                                        </dd>
                                                    </div>
                                                </div>
                                            )}
                                            {displayedBOM?.approvedBy && (
                                                <div className="sm:col-span-2 flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/10 p-4 shadow-sm">
                                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                                    <div>
                                                        <dt className="text-xs text-emerald-600">
                                                            Approved By
                                                        </dt>
                                                        <dd className="mt-0.5 font-medium text-neutral-900">
                                                            {displayedBOM.approvedBy} {displayedBOM.approvedAt ? `at ${new Date(displayedBOM.approvedAt).toLocaleString()}` : ""}
                                                        </dd>
                                                    </div>
                                                </div>
                                            )}
                                            {displayedBOM?.rejectedBy && (
                                                <div className="sm:col-span-2 flex flex-col gap-2 rounded-xl border border-rose-100 bg-rose-50/10 p-4 shadow-sm">
                                                    <div className="flex gap-3">
                                                        <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                                                        <div>
                                                            <dt className="text-xs text-rose-600">
                                                                Rejected By
                                                            </dt>
                                                            <dd className="mt-0.5 font-medium text-neutral-900">
                                                                {displayedBOM.rejectedBy} {displayedBOM.rejectedAt ? `at ${new Date(displayedBOM.rejectedAt).toLocaleString()}` : ""}
                                                            </dd>
                                                        </div>
                                                    </div>
                                                    {displayedBOM.approvalRemarks && (
                                                        <div className="mt-1 text-xs text-rose-800 bg-rose-50 p-3 rounded-lg border border-rose-100 leading-relaxed">
                                                            <span className="font-semibold">Rejection remarks:</span> {displayedBOM.approvalRemarks}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </dl>
                                    </div>

                                    <Separator />

                                    <div>
                                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                            Description
                                        </h4>
                                        <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-5 text-[15px] leading-relaxed text-neutral-700">
                                            {displayedBOM?.description?.trim() ? (
                                                <p className="whitespace-pre-wrap">
                                                    {displayedBOM.description.trim()}
                                                </p>
                                            ) : (
                                                <p className="text-neutral-400">
                                                    No description yet. Add one when you
                                                    create or edit this BOM.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent
                                value="components"
                                className="min-h-0 flex-1 overflow-y-auto px-6 py-6 focus-visible:outline-none"
                            >


                                {displayedBOM &&
                                    displayedBOM.componentRows &&
                                    displayedBOM.componentRows.length > 0 ? (
                                    <div className="space-y-3">
                                        {displayedBOM.componentRows
                                            .slice(0, COMPONENT_PREVIEW_LIMIT)
                                            .map((row) => {
                                                const hasDesc = !!row.description?.trim();
                                                const primary = hasDesc
                                                    ? row.description!.trim()
                                                    : row.partNumber?.trim() || "—";
                                                const partNo =
                                                    row.partNumber?.trim() || null;
                                                const mpn = row.mpn?.trim() || null;
                                                const mfr =
                                                    row.manufacturer?.trim() || null;
                                                const refDes =
                                                    row.refDesignator?.trim() || null;
                                                const extCost =
                                                    row.qpa * row.unitCost;
                                                const showCost =
                                                    typeof row.unitCost ===
                                                    "number" &&
                                                    row.unitCost > 0;
                                                const reqQty = Math.round(row.qpa * (displayedBOM.targetQty || 1));
                                                const impact = getInventoryImpactForSku(row.partNumber || "", reqQty);
                                                return (
                                                    <div
                                                        key={row.id}
                                                        className="relative overflow-hidden rounded-xl border border-neutral-100 bg-white py-4 pl-5 pr-4 shadow-sm ring-1 ring-neutral-100/80 transition-shadow hover:shadow-md"
                                                    >
                                                        <div
                                                            className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-gradient-to-b from-amber-400 to-orange-500"
                                                            aria-hidden
                                                        />
                                                        <div className="grid gap-4 pl-2 sm:grid-cols-[1fr_auto] sm:items-start">
                                                            <div className="min-w-0 space-y-2">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-md bg-neutral-100 px-1.5 text-xs font-semibold tabular-nums text-neutral-600">
                                                                        #
                                                                        {
                                                                            row.lineNumber
                                                                        }
                                                                    </span>
                                                                    {row.level >
                                                                        1 ? (
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className="border-neutral-200 bg-neutral-50 text-[10px] text-neutral-600"
                                                                        >
                                                                            Level{" "}
                                                                            {
                                                                                row.level
                                                                            }
                                                                        </Badge>
                                                                    ) : null}
                                                                </div>
                                                                <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900">
                                                                    {primary}
                                                                </p>
                                                                {hasDesc &&
                                                                    partNo ? (
                                                                    <p className="font-mono text-xs text-neutral-600">
                                                                        <span className="font-sans text-neutral-400">
                                                                            Part no.{" "}
                                                                        </span>
                                                                        {partNo}
                                                                    </p>
                                                                ) : null}
                                                                {mpn ? (
                                                                    <p className="text-xs text-neutral-600">
                                                                        <span className="text-neutral-400">
                                                                            MPN{" "}
                                                                        </span>
                                                                        <span className="font-mono">
                                                                            {mpn}
                                                                        </span>
                                                                    </p>
                                                                ) : null}
                                                                {mfr ? (
                                                                    <p className="flex items-center gap-1.5 text-xs text-neutral-600">
                                                                        <Factory className="h-3 w-3 shrink-0 text-neutral-400" />
                                                                        <span className="text-neutral-400">
                                                                            Mfr{" "}
                                                                        </span>
                                                                        {mfr}
                                                                    </p>
                                                                ) : null}
                                                                {refDes ? (
                                                                    <p className="text-xs text-neutral-600">
                                                                        <span className="text-neutral-400">
                                                                            Ref des{" "}
                                                                        </span>
                                                                        <span className="font-mono">
                                                                            {refDes}
                                                                        </span>
                                                                    </p>
                                                                ) : null}
                                                                {row.catalogSku ? (
                                                                    <Badge
                                                                        variant="secondary"
                                                                        className="w-fit border-violet-200 bg-violet-50 text-[10px] text-violet-800 block mb-1.5"
                                                                    >
                                                                        Inventory link · {row.catalogSku}
                                                                    </Badge>
                                                                ) : null}

                                                                {/* Inventory Impact Section */}
                                                                {row.partNumber && (
                                                                    <div className="mt-3.5 space-y-1.5 border-t border-neutral-100 pt-2.5 max-w-[280px]">
                                                                        <div className="flex items-center justify-between text-xs">
                                                                            <span className="text-neutral-500 font-medium">Inventory Stock:</span>
                                                                            {impact.notFound ? (
                                                                                <Badge variant="secondary" className="border-red-200 bg-red-50 text-[10px] text-red-800 font-semibold py-0 h-4">
                                                                                    Not in Catalog
                                                                                </Badge>
                                                                            ) : impact.sufficient ? (
                                                                                <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800 font-semibold py-0 h-4">
                                                                                    Sufficient
                                                                                </Badge>
                                                                            ) : (
                                                                                <Badge variant="secondary" className="border-rose-200 bg-rose-50 text-[10px] text-rose-800 font-semibold py-0 h-4">
                                                                                    Insufficient
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        {!impact.notFound && (
                                                                            <div className="text-[11px] text-neutral-500 space-y-0.5 leading-normal">
                                                                                <div className="flex justify-between">
                                                                                    <span>Required Total:</span>
                                                                                    <span className="font-semibold tabular-nums text-neutral-700">{reqQty} {row.uom}</span>
                                                                                </div>
                                                                                <div className="flex justify-between">
                                                                                    <span>Available (Total):</span>
                                                                                    <span className="font-semibold tabular-nums text-neutral-700">{impact.totalAvailable} {row.uom}</span>
                                                                                </div>
                                                                                <div className="mt-1 border-t border-neutral-50 pt-1 text-[10px] text-neutral-400">
                                                                                    <span className="font-medium text-neutral-500">Warehouse Stocks:</span>
                                                                                    {impact.breakdown.length === 0 ? (
                                                                                        <div className="pl-1 italic">No warehouses have stock</div>
                                                                                    ) : (
                                                                                        impact.breakdown.map((b: any, idx: number) => (
                                                                                            <div key={idx} className="flex justify-between pl-1">
                                                                                                <span className="truncate max-w-[150px]">{b.warehouse}</span>
                                                                                                <span className="tabular-nums font-medium">{b.stock}</span>
                                                                                            </div>
                                                                                        ))
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex shrink-0 flex-col items-end gap-1 border-t border-neutral-100 pt-3 text-right sm:border-t-0 sm:pt-0 sm:pl-2">
                                                                <span className="text-sm font-semibold tabular-nums text-neutral-900">
                                                                    ×{row.qpa}{" "}
                                                                    <span className="text-xs font-normal text-neutral-500">
                                                                        {row.uom}
                                                                    </span>
                                                                </span>
                                                                {showCost ? (
                                                                    <>
                                                                        <span className="text-xs text-neutral-500">
                                                                            Unit{" "}
                                                                            {formatCurrency(
                                                                                row.unitCost
                                                                            )}
                                                                        </span>
                                                                        <span className="text-sm font-semibold tabular-nums text-neutral-800">
                                                                            Ext.{" "}
                                                                            {formatCurrency(
                                                                                extCost
                                                                            )}
                                                                        </span>
                                                                    </>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        {displayedBOM.componentRows.length >
                                            COMPONENT_PREVIEW_LIMIT ? (
                                            <p className="pt-2 text-center text-xs text-neutral-400">
                                                +{" "}
                                                {displayedBOM.componentRows.length -
                                                    COMPONENT_PREVIEW_LIMIT}{" "}
                                                more lines — use Edit BOM to view and
                                                edit the full list.
                                            </p>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-neutral-200 bg-gradient-to-b from-neutral-50/80 to-white px-6 py-12 text-center">
                                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
                                            <Layers className="h-6 w-6 text-amber-600" />
                                        </div>
                                        <p className="text-sm font-medium text-neutral-700">
                                            No saved component lines yet
                                        </p>
                                        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-neutral-500">
                                            {displayedBOM && displayedBOM.components > 0
                                                ? `This BOM shows ${displayedBOM.components} line${displayedBOM.components === 1 ? "" : "s"} in the catalog, but there are no detailed rows stored. Open the editor to add parts.`
                                                : "Open the editor to add parts and build out this BOM."}
                                        </p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>

                        <SheetFooter className="shrink-0 gap-3 border-t border-neutral-200 bg-neutral-50/80 p-4 pb-6 sm:pb-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md sm:flex-row sm:items-stretch">
                            {displayedBOM && (
                                <>
                                    {(displayedBOM.status === "Draft" || displayedBOM.status === "Rejected") && (
                                        <>
                                            <Button
                                                className="min-h-11 flex-1 bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-sm hover:from-amber-500 hover:to-orange-400"
                                                onClick={handleSheetEdit}
                                            >
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Edit BOM
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="min-h-11 flex-1 border-amber-200 text-amber-700 hover:bg-amber-50 bg-white"
                                                onClick={() => handleSubmit(displayedBOM.id)}
                                            >
                                                Submit for Approval
                                            </Button>
                                        </>
                                    )}
                                    {displayedBOM.status === "Pending Approval" && (
                                        <>
                                            {isAdmin ? (
                                                <>
                                                    <Button
                                                        className="min-h-11 flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-500 hover:to-teal-400 shadow-md transition-all duration-300 font-semibold rounded-xl border-0"
                                                        onClick={() => handleApprove(displayedBOM.id)}
                                                    >
                                                        <Check className="mr-2 h-4 w-4" />
                                                        Approve BOM
                                                    </Button>
                                                    <Button
                                                        className="min-h-11 flex-1 bg-gradient-to-r from-rose-600 to-red-500 text-white hover:from-rose-500 hover:to-red-400 shadow-md transition-all duration-300 font-semibold rounded-xl border-0"
                                                        onClick={() => setRejectTargetId(displayedBOM.id)}
                                                    >
                                                        <X className="mr-2 h-4 w-4" />
                                                        Reject BOM
                                                    </Button>
                                                </>
                                            ) : (
                                                <div className="flex-grow text-center py-2.5 text-sm text-amber-800 bg-amber-50 rounded-lg border border-amber-100 font-medium flex items-center justify-center">
                                                    Awaiting administrator review (Read-only)
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {displayedBOM.status === "Approved" && (
                                        <div className="flex-grow text-center py-2.5 text-sm text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-100 font-medium flex items-center justify-center">
                                            Approved (Read-only)
                                        </div>
                                    )}
                                    {displayedBOM.status === "Archived" && (
                                        <div className="flex-grow text-center py-2.5 text-sm text-neutral-800 bg-neutral-100 rounded-lg border border-neutral-200 font-medium flex items-center justify-center">
                                            Archived (Read-only)
                                        </div>
                                    )}

                                    {canArchive(displayedBOM.status) && (
                                        <Button
                                            variant="outline"
                                            className="min-h-11 flex-1 border-neutral-200 bg-white/80"
                                            onClick={handleSheetArchive}
                                        >
                                            <Archive className="mr-2 h-4 w-4" />
                                            {displayedBOM.status === "Archived" ? "Unarchive" : "Archive"}
                                        </Button>
                                    )}
                                </>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="min-h-11 min-w-11 shrink-0 border-neutral-200 bg-white/80"
                                        disabled={!displayedBOM}
                                        aria-label="More actions"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[180px]">
                                    <DropdownMenuLabel>More</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={handleSheetDuplicate}
                                        disabled={!displayedBOM}
                                    >
                                        <Copy className="mr-2 h-3.5 w-3.5" />
                                        Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={handleSheetExportExcel}
                                        disabled={!displayedBOM}
                                    >
                                        <Download className="mr-2 h-3.5 w-3.5" />
                                        Export Excel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-red-600 focus:bg-red-50 focus:text-red-600"
                                        onClick={() => displayedBOM && setDeleteTarget(displayedBOM)}
                                        disabled={!displayedBOM || !canDelete(displayedBOM.status)}
                                    >
                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete BOM</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.id})?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Remarks Dialog */}
            <AlertDialog open={!!rejectTargetId} onOpenChange={(open) => !open && setRejectTargetId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject BOM Approval</AlertDialogTitle>
                        <AlertDialogDescription>
                            Please provide the rejection remarks / reasons for the creator.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <textarea
                            className="w-full min-h-[100px] p-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                            placeholder="Reason for rejection..."
                            value={rejectRemarks}
                            onChange={(e) => setRejectRemarks(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => { setRejectTargetId(null); setRejectRemarks(""); }}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRejectSubmit}
                            className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
                            disabled={!rejectRemarks.trim()}
                        >
                            Reject
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
