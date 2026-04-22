"use client";

import { useState, useRef } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as XLSX from "xlsx";
import { Plus, UploadCloud, X, Loader2 } from "lucide-react";
import { toast } from "sonner"; // Provided from the modern UI stack

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

const formSchema = z.object({
    name: z.string().min(1, "Location name is required"),
    zone: z.string().min(1, "Zone is required"),
    total_components: z.string().refine(v => !isNaN(Number(v)) && Number(v) >= 0, "Total Components must be a valid number (>= 0)"),
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
    const [importedData, setImportedData] = useState<WarehouseLocation[]>([]);
    const [fileName, setFileName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            zone: "",
            total_components: "0",
            status: "Active",
        },
    });

    const processFile = (file: File) => {
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                const newLocations = jsonData.map((row: any) => ({
                    name: row.name || row.Name || "New Warehouse",
                    zone: row.zone || row.Zone || "Unassigned",
                    total_components: parseInt(row.total_components || row["Total Components"] || 0) || 0,
                    status: row.status || row.Status || "Active",
                }));

                setImportedData(newLocations);
                if (newLocations.length > 0) {
                    toast.success(`Successfully parsed ${newLocations.length} locations`);
                }
            } catch (error) {
                console.error("Error parsing Excel file:", error);
                toast.error("Failed to parse Excel file. Please ensure it is a valid format.");
                setFileName(null);
                setImportedData([]);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFile(file);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleRemoveFile = () => {
        setFileName(null);
        setImportedData([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        try {
            if (importedData.length > 0) {
                await onImport(importedData);
                toast.success("Successfully imported warehouse locations!");
            } else {
                await onAdd({
                    name: values.name,
                    zone: values.zone,
                    total_components: Number(values.total_components),
                    status: values.status,
                });
                toast.success("Warehouse location added successfully");
            }
            form.reset();
            handleRemoveFile();
            setOpen(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to add warehouse");
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

    const isValid = form.formState.isValid || importedData.length > 0;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="bg-neutral-950 hover:bg-neutral-800 text-white shadow-md transition-colors">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Location
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
                <DialogHeader className="px-6 py-5 bg-neutral-50/50 border-b border-neutral-100">
                    <DialogTitle className="text-xl font-bold tracking-tight text-neutral-900">Add New Warehouse Location</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">

                        {/* Drag and Drop Excel File Upload Area */}
                        <div className="flex flex-col mb-2">
                            <div
                                className={`relative group flex flex-col h-32 w-full items-center justify-center rounded-2xl transition-all cursor-pointer border-2 border-dashed ${isDragging
                                        ? "border-emerald-500 bg-emerald-50"
                                        : "bg-neutral-50 border-neutral-200 hover:border-emerald-400 hover:bg-white shadow-sm"
                                    }`}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {fileName ? (
                                    <div className="flex flex-col items-center gap-2 p-4 text-center">
                                        <div className="flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-full">
                                            <UploadCloud className="h-4 w-4" />
                                            <span className="truncate max-w-[200px]">{fileName}</span>
                                        </div>
                                        <span className="text-sm font-medium text-neutral-600">
                                            {importedData.length} location(s) ready
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFile();
                                            }}
                                            className="absolute top-3 right-3 p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 text-neutral-500">
                                        <div className="p-3 bg-white shadow-sm rounded-full group-hover:scale-110 transition-transform duration-300">
                                            <UploadCloud className={`h-6 w-6 ${isDragging ? 'text-emerald-500' : 'text-neutral-400 group-hover:text-emerald-500'}`} />
                                        </div>
                                        <div className="text-center">
                                            <span className="text-sm font-semibold text-neutral-700 block">Upload Excel (Optional)</span>
                                            <span className="text-xs text-neutral-400 font-medium">Drag & drop or click to browse</span>
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
                        </div>

                        {!fileName && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 py-2">
                                    <div className="h-px flex-1 bg-neutral-100"></div>
                                    <span className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase">Or Add Manually</span>
                                    <div className="h-px flex-1 bg-neutral-100"></div>
                                </div>

                                <div className="space-y-4 rounded-xl">
                                    <div className="space-y-4 bg-white">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-neutral-700 font-semibold text-xs">Location Name</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="e.g. Area 51"
                                                            className="rounded-xl border-neutral-200 bg-neutral-50 focus-visible:ring-emerald-500 focus-visible:bg-white transition-all shadow-sm h-11"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage className="text-xs" />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="zone"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-neutral-700 font-semibold text-xs">Zone</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="e.g. Basement"
                                                            className="rounded-xl border-neutral-200 bg-neutral-50 focus-visible:ring-emerald-500 focus-visible:bg-white transition-all shadow-sm h-11"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage className="text-xs" />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="total_components"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-neutral-700 font-semibold text-xs">Total Components</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            placeholder="e.g. 100"
                                                            className="rounded-xl border-neutral-200 bg-neutral-50 focus-visible:ring-emerald-500 focus-visible:bg-white transition-all shadow-sm h-11"
                                                            min="0"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage className="text-xs" />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <DialogFooter className="pt-2 gap-2 sm:gap-0 mt-6 border-t border-neutral-100 pt-6">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => !isLoading && setOpen(false)}
                                disabled={isLoading}
                                className="rounded-full shadow-sm hover:bg-neutral-100 font-medium px-6 focus:ring-2 focus:ring-neutral-200 transition-all border-neutral-200"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading || !isValid}
                                className="rounded-full bg-neutral-950 hover:bg-neutral-800 text-white shadow-md hover:shadow-lg transition-all font-semibold px-8 focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    fileName ? "Import Locations" : "Save Location"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
