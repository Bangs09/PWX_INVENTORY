"use client";

import { useState, useEffect } from "react";
import { AddWarehouseDialog, WarehouseLocation } from "./add_warehouse";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClientRole } from "@/lib/use-client-role";
import { Badge } from "@/components/ui/badge";
import { Warehouse as WarehouseIcon, Search, Filter, MapPin, Package, Trash2, Edit2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function WarehousePage() {
    const { role } = useClientRole();
    const [locations, setLocations] = useState<WarehouseLocation[]>([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
    const [componentSearch, setComponentSearch] = useState("");
    const [locationComponents, setLocationComponents] = useState<any[]>([]);
    const [isFetchingSub, setIsFetchingSub] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [editLocation, setEditLocation] = useState<WarehouseLocation | null>(null);
    const [editName, setEditName] = useState("");
    const [editZone, setEditZone] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const fetchLocationComponents = async (whName: string) => {
        try {
            setIsFetchingSub(true);
            const res = await fetch("/api/inventory/components");
            if (res.ok) {
                const all = await res.json();
                const filtered = all.filter((c: any) => c.warehouse === whName);
                setLocationComponents(filtered);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsFetchingSub(false);
        }
    };

    const fetchWarehouses = async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/warehouses');
            if (res.ok) {
                const data = await res.json();
                setLocations(data);
                
                // If a location is selected, also refresh its specific component list
                if (selectedLocation) {
                    fetchLocationComponents(selectedLocation);
                }
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load warehouses");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWarehouses();
        const interval = setInterval(fetchWarehouses, 5000); // 5s Real-time polling
        return () => clearInterval(interval);
    }, []);

    const handleAddLocation = async (newLocation: WarehouseLocation) => {
        try {
            const res = await fetch('/api/warehouses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLocation)
            });
            if (!res.ok) throw new Error("API Error");
            await fetchWarehouses(); // Refresh list so dashboard gets updated behind scenes inherently
        } catch (error) {
            throw error; // Let modal handle error toast
        }
    };

    const handleImportLocations = async (newLocations: WarehouseLocation[]) => {
        try {
            for (const loc of newLocations) {
                const res = await fetch('/api/warehouses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(loc)
                });
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error || `Failed to import ${loc.name}`);
                }
            }
            await fetchWarehouses();
        } catch (error) {
            throw error;
        }
    };

    const handleDeleteWarehouse = async (id: number) => {
        try {
            const res = await fetch(`/api/warehouses/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Failed to delete");
            toast.success("Warehouse deleted successfully");
            await fetchWarehouses();
        } catch (error) {
            toast.error("An error occurred while deleting");
        } finally {
            setDeleteConfirm(null);
        }
    };

    const handleSaveEdit = async () => {
        if (!editLocation || !editName.trim() || !editZone.trim()) return;
        setIsSavingEdit(true);
        try {
            const res = await fetch(`/api/warehouses/${editLocation.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editLocation,
                    name: editName.trim(),
                    zone: editZone.trim(),
                })
            });
            if (!res.ok) throw new Error("Failed to update");
            toast.success("Warehouse updated successfully");
            await fetchWarehouses();
            setEditLocation(null);
        } catch (error) {
            toast.error("Failed to update warehouse");
        } finally {
            setIsSavingEdit(false);
        }
    };

    const filtered = locations.filter(
        (loc) =>
            loc.name.toLowerCase().includes(search.toLowerCase()) ||
            loc.zone.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
                        Warehouse
                    </h1>
                    <p className="mt-1 text-neutral-500">
                        Manage storage locations and allocations
                    </p>
                </div>
                {role === "admin" && (
                    <AddWarehouseDialog 
                        onAdd={handleAddLocation} 
                        onImport={handleImportLocations} 
                    />
                )}
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                        placeholder="Search locations..."
                        className="border-neutral-200 bg-white pl-9 text-neutral-900 placeholder:text-neutral-500 rounded-xl"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button variant="outline" className="border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 rounded-xl">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                </Button>
            </div>

            {/* Location Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center p-20 text-neutral-400">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 text-neutral-400 bg-white border border-neutral-100 rounded-[20px] border-dashed">
                    <WarehouseIcon className="h-10 w-10 text-neutral-300 mb-4" />
                    <p className="text-neutral-500 font-medium tracking-tight">No warehouses found.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((loc, index) => (
                        <Card
                            key={loc.id || index}
                            onClick={() => {
                                setSelectedLocation(loc.name);
                                setComponentSearch("");
                                fetchLocationComponents(loc.name);
                            }}
                            className="group cursor-pointer border-neutral-100 bg-white shadow-sm transition-all duration-300 hover:border-emerald-200 hover:shadow-lg hover:-translate-y-1 rounded-[22px] overflow-hidden"
                        >
                            <CardHeader className="pb-4 bg-neutral-50/30">
                                <div className="flex items-start justify-between relative">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 group-hover:bg-emerald-100 transition-all duration-300">
                                        <WarehouseIcon className="h-5 w-5" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant="secondary"
                                            className={
                                                loc.status === "Active"
                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                    : loc.status === "Inactive"
                                                        ? "border-amber-200 bg-amber-50 text-amber-700"
                                                        : "border-neutral-200 bg-neutral-100 text-neutral-600"
                                            }
                                        >
                                            {loc.status}
                                        </Badge>
                                        {role === "admin" && loc.id && (
                                            <>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditLocation(loc);
                                                        setEditName(loc.name);
                                                        setEditZone(loc.zone);
                                                    }}
                                                    className="p-1.5 text-neutral-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirm(loc.id!);
                                                    }}
                                                    className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <CardTitle className="mt-4 text-[17px] font-bold tracking-tight text-neutral-900 group-hover:text-emerald-700 transition-colors">{loc.name}</CardTitle>
                                <CardDescription className="flex items-center gap-1.5 text-[13px] text-neutral-500 font-medium">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {loc.zone}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4 pb-5 bg-white border-t border-neutral-50">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/50 border border-neutral-100">
                                    <div className="flex items-center gap-2">
                                        <Package className="h-4 w-4 text-neutral-400" />
                                        <span className="text-sm font-semibold text-neutral-600">Unique Items</span>
                                    </div>
                                    <span className="text-2xl font-black tracking-tighter text-neutral-900">{loc.total_components}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Components Dialog (Placeholder for Real Content Later) */}
            <Dialog open={!!selectedLocation} onOpenChange={(open) => !open && setSelectedLocation(null)}>
                <DialogContent className="sm:max-w-[600px] text-black overflow-hidden rounded-[20px] p-0 border border-neutral-200/60 shadow-xl bg-white mx-auto w-[90vw]">
                    <DialogHeader className="px-5 sm:px-6 py-5 border-b border-neutral-100 bg-neutral-50/50">
                        <DialogTitle className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2">
                            <WarehouseIcon className="h-5 w-5 text-emerald-600" />
                            {selectedLocation} Components
                        </DialogTitle>
                        <DialogDescription>
                            Unique component types stored in this location
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-5 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                            <Input
                                placeholder="Search components by name or category..."
                                className="border-neutral-200 bg-white pl-9 text-neutral-900 placeholder:text-neutral-500 rounded-xl"
                                value={componentSearch}
                                onChange={(e) => setComponentSearch(e.target.value)}
                            />
                        </div>

                        <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-2">
                            {isFetchingSub ? (
                                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-neutral-300" /></div>
                            ) : locationComponents.filter(c => 
                                c.name.toLowerCase().includes(componentSearch.toLowerCase()) || 
                                c.category.toLowerCase().includes(componentSearch.toLowerCase())
                            ).length > 0 ? (
                                locationComponents.filter(c => 
                                    c.name.toLowerCase().includes(componentSearch.toLowerCase()) || 
                                    c.category.toLowerCase().includes(componentSearch.toLowerCase())
                                ).map((comp, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 bg-white hover:border-neutral-200 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                                <Package className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-neutral-900">{comp.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge variant="outline" className="border-neutral-200 text-neutral-500 text-[10px] uppercase font-semibold h-5 px-1.5">
                                                        {comp.category}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-neutral-900">{comp.stock}</p>
                                            <p className="text-xs text-neutral-500">In Stock</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-neutral-500">
                                    <Package className="h-10 w-10 mx-auto mb-3 text-neutral-200" />
                                    <p className="text-sm font-medium">No real hardware components assigned here yet</p>
                                    <p className="text-xs mt-1">Visit Inventory to transfer components to this location</p>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
                <DialogContent className="sm:max-w-[400px] text-black overflow-hidden rounded-[20px] p-6 border border-neutral-200/60 shadow-xl bg-white mx-auto w-[90vw]">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-xl font-bold text-neutral-900">
                            Confirm Deletion
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Confirm deletion of warehouse location
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-neutral-600 text-sm mb-6">
                        Are you sure you want to delete this warehouse location? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-xl border-neutral-200 hover:bg-neutral-100">
                            Cancel
                        </Button>
                        <Button className="rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md font-medium" onClick={() => handleDeleteWarehouse(deleteConfirm!)}>
                            OK
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Warehouse Dialog */}
            <Dialog open={editLocation !== null} onOpenChange={(open) => !open && setEditLocation(null)}>
                <DialogContent className="sm:max-w-[450px] text-black overflow-hidden rounded-[20px] p-6 border border-neutral-200/60 shadow-xl bg-white mx-auto w-[90vw]">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                            <Edit2 className="h-5 w-5 text-blue-500" />
                            Edit Warehouse
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Edit details of the warehouse location
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-700">Warehouse Name</label>
                            <Input 
                                value={editName} 
                                onChange={(e) => setEditName(e.target.value)} 
                                className="border-neutral-200 bg-white"
                                placeholder="Enter warehouse name..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-700">Zone / Area</label>
                            <Input 
                                value={editZone} 
                                onChange={(e) => setEditZone(e.target.value)} 
                                className="border-neutral-200 bg-white"
                                placeholder="Enter zone..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="outline" onClick={() => setEditLocation(null)} className="rounded-xl border-neutral-200 hover:bg-neutral-100">
                            Cancel
                        </Button>
                        <Button 
                            className="rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white shadow-md font-medium" 
                            onClick={handleSaveEdit}
                            disabled={isSavingEdit || !editName.trim() || !editZone.trim()}
                        >
                            {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save Changes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
