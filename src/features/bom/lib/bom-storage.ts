/** Matches rows persisted by the create BOM flow (SQLite / Database). */
export interface StoredComponentRow {
    id?: string;
    lineNumber: number;
    level: number;
    partNumber: string;
    description: string;
    qpa: number;
    uom: string;
    unitCost: number;
    manufacturer: string;
    mpn: string;
    refDesignator: string;
    /** When set, line was linked from the Components inventory catalog (SKU). */
    catalogSku?: string;
}

export interface BOMEntry {
    id: string;
    name: string;
    /** Line count for list cards / table. */
    components: number;
    revision: string;
    status: string;
    author: string;
    lastModified: string;
    description?: string;
    cpn?: string;
    phase?: string;
    assemblyUom?: string;
    targetQty?: number;
    totalCost?: number;
    /** Full lines when loaded from storage or edit flow. */
    componentRows?: StoredComponentRow[];
    /** Persisted when there are no rows but we still show a count. */
    componentCount?: number;
    
    // Approval & Workflow details
    submittedBy?: string | null;
    submittedAt?: string | null;
    approvedBy?: string | null;
    approvedAt?: string | null;
    rejectedBy?: string | null;
    rejectedAt?: string | null;
    approvalRemarks?: string | null;
    lastModifiedBy?: string;
    lastModifiedAt?: string;
    transactions?: any[];
}

export function mapRawToEntry(b: Record<string, unknown>): BOMEntry {
    const rawComponents = Array.isArray(b.componentRows)
        ? (b.componentRows as StoredComponentRow[])
        : Array.isArray(b.components)
          ? (b.components as StoredComponentRow[])
          : [];
    const fallbackCount =
        typeof b.componentCount === "number"
            ? b.componentCount
            : typeof b.components === "number"
              ? (b.components as number)
              : 0;
    const lineCount =
        rawComponents.length > 0 ? rawComponents.length : fallbackCount;

    // Formatting lastModified from database fields if present
    let displayLastModified = String(b.lastModified ?? b.last_modified_at ?? "");
    if (b.last_modified_at) {
        displayLastModified = new Date(b.last_modified_at as string).toLocaleDateString() + ' ' + 
            new Date(b.last_modified_at as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return {
        id: String(b.id ?? ""),
        name: String(b.name ?? ""),
        components: lineCount,
        revision: String(b.revision ?? "Rev A"),
        status: String(b.status ?? "Draft"),
        author: String(b.author ?? "Current User"),
        lastModified: displayLastModified,
        description: typeof b.description === "string" ? b.description : undefined,
        cpn: typeof b.cpn === "string" ? b.cpn : undefined,
        phase: typeof b.phase === "string" ? b.phase : undefined,
        assemblyUom:
            typeof b.assemblyUom === "string" ? b.assemblyUom : undefined,
        targetQty: typeof b.target_qty === "number" 
            ? b.target_qty 
            : typeof b.targetQty === "number" 
              ? b.targetQty 
              : undefined,
        totalCost: typeof b.total_cost === "number" 
            ? b.total_cost 
            : typeof b.totalCost === "number" 
              ? b.totalCost 
              : undefined,
        componentRows: rawComponents.length > 0 
            ? rawComponents.map((r, i) => ({
                id: r.id,
                lineNumber: r.lineNumber ?? (r as any).line_number ?? i + 1,
                level: r.level ?? 1,
                partNumber: r.partNumber ?? (r as any).part_number ?? "",
                description: r.description ?? "",
                qpa: r.qpa ?? 1,
                uom: r.uom ?? "Each",
                unitCost: r.unitCost ?? (r as any).unit_cost ?? 0,
                manufacturer: r.manufacturer ?? "",
                mpn: r.mpn ?? "",
                refDesignator: r.refDesignator ?? (r as any).ref_designator ?? "",
                catalogSku: r.catalogSku ?? (r as any).catalog_sku ?? undefined,
              }))
            : undefined,
        componentCount:
            rawComponents.length === 0 && typeof b.componentCount === "number"
                ? b.componentCount
                : undefined,
        
        submittedBy: b.submitted_by as string | null,
        submittedAt: b.submitted_at as string | null,
        approvedBy: b.approved_by as string | null,
        approvedAt: b.approved_at as string | null,
        rejectedBy: b.rejected_by as string | null,
        rejectedAt: b.rejected_at as string | null,
        approvalRemarks: b.approval_remarks as string | null,
        lastModifiedBy: b.last_modified_by as string,
        lastModifiedAt: b.last_modified_at as string,
        transactions: Array.isArray(b.transactions) ? b.transactions : undefined,
    };
}

export const defaultBOMs: BOMEntry[] = [];

// ─── API Helper Functions ───────────────────────────────────────────

export async function fetchBOMsFromServer(): Promise<BOMEntry[]> {
    const res = await fetch("/api/bom");
    if (!res.ok) throw new Error("Failed to load BOMs from server");
    const data = await res.json();
    return data.map((raw: any) => mapRawToEntry(raw));
}

export async function fetchBOMByIdFromServer(id: string): Promise<BOMEntry> {
    const res = await fetch(`/api/bom/${id}`);
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load BOM details");
    }
    const data = await res.json();
    return mapRawToEntry(data);
}

export async function saveBOMToServer(bom: Partial<BOMEntry>): Promise<BOMEntry> {
    const res = await fetch("/api/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bom),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save BOM");
    }
    const data = await res.json();
    return mapRawToEntry(data);
}

export async function submitBOMForApprovalOnServer(id: string): Promise<BOMEntry> {
    const res = await fetch(`/api/bom/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit BOM for approval");
    }
    const data = await res.json();
    return mapRawToEntry(data);
}

export async function approveBOMOnServer(id: string): Promise<BOMEntry> {
    const res = await fetch(`/api/bom/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to approve BOM");
    }
    const data = await res.json();
    return mapRawToEntry(data);
}

export async function rejectBOMOnServer(id: string, remarks: string): Promise<BOMEntry> {
    const res = await fetch(`/api/bom/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", remarks }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to reject BOM");
    }
    const data = await res.json();
    return mapRawToEntry(data);
}

export async function archiveBOMOnServer(id: string): Promise<BOMEntry> {
    const res = await fetch(`/api/bom/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to archive BOM");
    }
    const data = await res.json();
    return mapRawToEntry(data);
}

export async function deleteBOMOnServer(id: string): Promise<void> {
    const res = await fetch(`/api/bom/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete BOM");
    }
}
