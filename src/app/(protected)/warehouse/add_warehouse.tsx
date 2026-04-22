"use client";

import { useState, useRef } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as XLSX from "xlsx";
import { Plus, UploadCloud, X, Loader2, Warehouse, Cpu, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export interface WarehouseLocation {
    id?: number;
    name: string;
    zone: string;
    total_components: number;
    status: string;
}

type DetectedFormat = "warehouses" | "components" | "unknown" | null;

const WAREHOUSE_HEADERS = ["location name", "name", "zone", "total components"];
const COMPONENT_HEADERS = ["name", "sku", "category", "stock"];

function detectFormat(headers: string[]): DetectedFormat {
    const normalized = headers.map(h => String(h).toLowerCase().trim());
    const hasSkuAndCategory =
        normalized.some(h => h === "sku") &&
        normalized.some(h => h === "category");
    if (hasSkuAndCategory) return "components";

    const hasLocationOrZone =
        normalized.some(h => h === "zone" || h === "location name") ||
        normalized.some(h => h === "total components");
    if (hasLocationOrZone) return "warehouses";

    // Fallback heuristics
    const componentScore = COMPONENT_HEADERS.filter(h => normalized.includes(h)).length;
    const warehouseScore = WAREHOUSE_HEADERS.filter(h => normalized.includes(h)).length;
    if (componentScore >= 3) return "components";
    if (warehouseScore >= 2) return "warehouses";
    return "unknown";
}

const formSchema = z.object({
    name: z.string().min(1, "Location name is required"),
    zone: z.string().min(1, "Zone is required"),
    total_components: z.string().refine(v => !isNaN(Number(v)) && Number(v) >= 0, "Total Components must be >= 0"),
    status: z.string().min(1, "Status is required"),
});

export function AddWarehouseDialog({
    onAdd,
    onImport,
}: {
    onAdd: (location: WarehouseLocation) => Promise<void>;
    onImport: (locations: WarehouseLocation[]) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [detectedFormat, setDetectedFormat] = useState<DetectedFormat>(null);
    const [parsedRows, setParsedRows] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [importResult, setImportResult] = useState<{
        imported: number; failed: number; failedRows: { row: number; reason: string }[];
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { name: "", zone: "", total_components: "0", status: "Active" },
    });

    const processFile = (file: File) => {
        setFileName(file.name);
        setDetectedFormat(null);
        setParsedRows([]);
        setImportResult(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });

                // Try named sheets first (Components / Warehouse Locations), then sheet[0]
                let sheet = workbook.Sheets["Components"] || workbook.Sheets["Warehouse Locations"] || workbook.Sheets[workbook.SheetNames[0]];
                if (!sheet) throw new Error("No sheet found");

                const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
                if (rows.length === 0) {
                    toast.error("The uploaded file has no data rows.");
                    handleRemoveFile();
                    return;
                }

                const headers = Object.keys(rows[0]);
                const format = detectFormat(headers);

                if (format === "unknown") {
                    toast.error("Unsupported file format", {
                        description: "Columns not recognized. Use the Download Template to get the correct format.",
                    });
                    handleRemoveFile();
                    return;
                }

                setDetectedFormat(format);
                setParsedRows(rows);
                toast.success(`Detected: ${format === "components" ? "Components Inventory" : "Warehouse Locations"}`, {
                    description: `${rows.length} row(s) ready to import.`,
                });
            } catch (error) {
                console.error("Error parsing file:", error);
                toast.error("Failed to parse file. Please check the format.");
                handleRemoveFile();
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFile(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const handleRemoveFile = () => {
        setFileName(null);
        setDetectedFormat(null);
        setParsedRows([]);
        setImportResult(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        try {
            if (parsedRows.length > 0 && detectedFormat) {
                // Use unified import API
                const res = await fetch("/api/import-data", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ format: detectedFormat, rows: parsedRows }),
                });

                const result = await res.json();
                if (!res.ok) throw new Error(result.error || "Import failed");

                setImportResult(result);

                if (result.failed === 0) {
                    toast.success("Import completed successfully!", {
                        description: `${result.imported} item(s) imported.`,
                    });
                    // Notify parent to refresh
                    if (detectedFormat === "warehouses") {
                        await onImport([]); // triggers fetchWarehouses in parent
                    }
                    form.reset();
                    handleRemoveFile();
                    setOpen(false);
                } else {
                    toast.warning(`Import completed with issues`, {
                        description: `${result.imported} imported, ${result.failed} failed.`,
                    });
                    if (detectedFormat === "warehouses") await onImport([]);
                }
            } else {
                // Manual add single warehouse
                await onAdd({
                    name: values.name,
                    zone: values.zone,
                    total_components: Number(values.total_components),
                    status: values.status,
                });
                toast.success("Warehouse location added successfully");
                form.reset();
                setOpen(false);
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to import");
        } finally {
            setIsLoading(false);
        }
    }

    function handleOpenChange(newOpen: boolean) {
        if (!newOpen && !isLoading) {
            form.reset();
            handleRemoveFile();
            setOpen(false);
        } else if (newOpen) {
            setOpen(true);
        }
    }

    const isValid = form.formState.isValid || parsedRows.length > 0;

    const formatLabel = detectedFormat === "components"
        ? "Components Inventory"
        : detectedFormat === "warehouses"
        ? "Warehouse Locations"
        : null;

    const FormatIcon = detectedFormat === "components" ? Cpu : Warehouse;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="bg-neutral-950 hover:bg-neutral-800 text-white shadow-md transition-colors">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Location
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
                <DialogHeader className="px-6 py-5 bg-neutral-50/50 border-b border-neutral-100">
                    <DialogTitle className="text-xl font-bold tracking-tight text-neutral-900">Add Warehouse Location</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-5">

                        {/* File drop zone */}
                        <div
                            className={`relative group flex flex-col h-32 w-full items-center justify-center rounded-2xl transition-all cursor-pointer border-2 border-dashed ${
                                isDragging
                                    ? "border-emerald-500 bg-emerald-50"
                                    : parsedRows.length > 0
                                    ? "border-emerald-400 bg-emerald-50/60"
                                    : "bg-neutral-50 border-neutral-200 hover:border-emerald-400 hover:bg-white shadow-sm"
                            }`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => !parsedRows.length && fileInputRef.current?.click()}
                        >
                            {fileName && detectedFormat ? (
                                <div className="flex flex-col items-center gap-1.5 p-4 text-center">
                                    <div className="flex items-center gap-2 text-emerald-700 font-bold bg-emerald-100 px-3 py-1.5 rounded-full text-sm">
                                        <FormatIcon className="h-4 w-4 shrink-0" />
                                        <span className="truncate max-w-[200px]">{fileName}</span>
                                    </div>
                                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                        {formatLabel} · {parsedRows.length} row(s)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                                        className="absolute top-2.5 right-2.5 p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2.5 text-neutral-500">
                                    <div className="p-2.5 bg-white shadow-sm rounded-full group-hover:scale-110 transition-transform duration-300">
                                        <UploadCloud className={`h-5 w-5 ${isDragging ? "text-emerald-500" : "text-neutral-400 group-hover:text-emerald-500"}`} />
                                    </div>
                                    <div className="text-center">
                                        <span className="text-sm font-semibold text-neutral-700 block">Upload Excel (Optional)</span>
                                        <span className="text-xs text-neutral-400 font-medium">Warehouses or Components format · drag & drop or click</span>
                                    </div>
                                </div>
                            )}
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                        </div>

                        {/* Import result summary */}
                        {importResult && (
                            <div className={`rounded-xl p-3 text-sm border ${importResult.failed === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                                <div className="flex items-center gap-1.5 font-semibold mb-1">
                                    {importResult.failed === 0
                                        ? <CheckCircle2 className="h-4 w-4" />
                                        : <AlertTriangle className="h-4 w-4" />}
                                    {importResult.imported} imported · {importResult.failed} failed
                                </div>
                                {importResult.failedRows.slice(0, 4).map((f, i) => (
                                    <p key={i} className="text-xs opacity-80">Row {f.row}: {f.reason}</p>
                                ))}
                                {importResult.failedRows.length > 4 && (
                                    <p className="text-xs opacity-60 italic">+{importResult.failedRows.length - 4} more errors…</p>
                                )}
                            </div>
                        )}

                        {/* Manual form (only shown when no file is uploaded) */}
                        {!fileName && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 py-1">
                                    <div className="h-px flex-1 bg-neutral-100" />
                                    <span className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase">Or Add Manually</span>
                                    <div className="h-px flex-1 bg-neutral-100" />
                                </div>

                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-neutral-700 font-semibold text-xs">Location Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Area 51" className="rounded-xl border-neutral-200 bg-neutral-50 focus-visible:ring-emerald-500 focus-visible:bg-white transition-all shadow-sm h-11" {...field} />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="zone" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-neutral-700 font-semibold text-xs">Zone</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Basement" className="rounded-xl border-neutral-200 bg-neutral-50 focus-visible:ring-emerald-500 focus-visible:bg-white transition-all shadow-sm h-11" {...field} />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="total_components" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-neutral-700 font-semibold text-xs">Total Components</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="e.g. 100" className="rounded-xl border-neutral-200 bg-neutral-50 focus-visible:ring-emerald-500 focus-visible:bg-white transition-all shadow-sm h-11" min="0" {...field} />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                    </FormItem>
                                )} />
                            </div>
                        )}

                        <DialogFooter className="pt-2 gap-2 sm:gap-0 mt-4 border-t border-neutral-100 pt-5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => !isLoading && setOpen(false)}
                                disabled={isLoading}
                                className="rounded-full shadow-sm hover:bg-neutral-100 font-medium px-6 border-neutral-200"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading || !isValid}
                                className="rounded-full bg-neutral-950 hover:bg-neutral-800 text-white shadow-md font-semibold px-8"
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</>
                                ) : parsedRows.length > 0 ? (
                                    `Import ${detectedFormat === "components" ? "Components" : "Locations"}`
                                ) : (
                                    "Save Location"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
