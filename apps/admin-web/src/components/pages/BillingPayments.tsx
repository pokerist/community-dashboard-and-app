import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Search, Plus, Download, CreditCard, TrendingUp, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import apiClient from "../../lib/api-client";
import { errorMessage, formatCurrencyEGP, formatDate, getStatusColorClass, humanizeEnum } from "../../lib/live-data";

const INVOICE_TYPES = [
  "RENT",
  "SERVICE_FEE",
  "UTILITY",
  "FINE",
  "MAINTENANCE_FEE",
  "BOOKING_FEE",
  "SETUP_FEE",
  "LATE_FEE",
  "MISCELLANEOUS",
  "OWNER_EXPENSE",
  "MANAGEMENT_FEE",
];

type ResidentOption = {
  userId: string;
  name: string;
  email: string;
  residentId?: string;
  units: { id: string; label: string }[];
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  unitId?: string;
  unitLabel: string;
  residentLabel: string;
  residentId?: string;
  type: string;
  amountValue: number;
  amountLabel: string;
  dueDate: string;
  status: string;
  paidDate: string | null;
};

type OwnerInstallmentRow = {
  id: string;
  ownerName: string;
  ownerEmail: string;
  unitLabel: string;
  amountValue: number;
  amountLabel: string;
  dueDateRaw: string;
  dueDate: string;
  status: string;
  reminderSentAt: string | null;
  overdueNotifiedAt: string | null;
};

export function BillingPayments() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [invoicesData, setInvoicesData] = useState<InvoiceRow[]>([]);
  const [ownerInstallments, setOwnerInstallments] = useState<OwnerInstallmentRow[]>([]);
  const [installmentsLoading, setInstallmentsLoading] = useState(false);
  const [installmentActionId, setInstallmentActionId] = useState<string | null>(null);
  const [residentOptions, setResidentOptions] = useState<ResidentOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invoiceFormData, setInvoiceFormData] = useState({
    residentUserId: "",
    unitId: "",
    type: "",
    amount: "",
    dueDate: "",
    description: "",
  });

  const loadBillingData = useCallback(async () => {
    setIsLoading(true);
    setInstallmentsLoading(true);
    setLoadError(null);
    try {
      const [invoicesRes, residentsRes, installmentsRes] = await Promise.all([
        apiClient.get("/invoices"),
        apiClient.get("/admin/users", { params: { userType: "resident", take: 200, skip: 0 } }),
        apiClient.get("/owners/payment-plans/installments", {
          params: { status: "ALL" },
        }),
      ]);

      const invoiceRows = (Array.isArray(invoicesRes.data) ? invoicesRes.data : []).map((invoice: any) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber ?? invoice.id,
        unitId: invoice.unitId,
        unitLabel: invoice.unit?.unitNumber ? `${invoice.unit?.projectName ?? ""} ${invoice.unit.unitNumber}`.trim() : "—",
        residentLabel: invoice.resident?.nameEN ?? invoice.resident?.email ?? "—",
        residentId: invoice.residentId,
        type: humanizeEnum(invoice.type),
        amountValue: Number(invoice.amount ?? 0),
        amountLabel: formatCurrencyEGP(invoice.amount),
        dueDate: formatDate(invoice.dueDate),
        status: humanizeEnum(invoice.status),
        paidDate: invoice.paidDate ? formatDate(invoice.paidDate) : null,
      }));

      const residents = Array.isArray(residentsRes.data) ? residentsRes.data : [];
      const options: ResidentOption[] = residents.map((user: any) => ({
        userId: user.id,
        residentId: user.resident?.id,
        name: user.nameEN ?? user.email ?? "Resident",
        email: user.email ?? "",
        units:
          user?.resident?.residentUnits?.map((ru: any) => ({
            id: ru.unit?.id,
            label: [ru.unit?.projectName, ru.unit?.block && `Block ${ru.unit.block}`, ru.unit?.unitNumber]
              .filter(Boolean)
              .join(" - "),
          }))?.filter((u: any) => !!u.id) ?? [],
      }));

      setInvoicesData(invoiceRows);
      setResidentOptions(options);
      const installmentsRows = (Array.isArray(installmentsRes.data) ? installmentsRes.data : []).map((row: any) => {
        const amount = Number(row.amount ?? 0);
        const owner = row.ownerUnitContract?.ownerUser;
        const unit = row.ownerUnitContract?.unit;
        return {
          id: String(row.id),
          ownerName: owner?.nameEN ?? owner?.email ?? "Owner",
          ownerEmail: owner?.email ?? "—",
          unitLabel: [unit?.projectName, unit?.block ? `Block ${unit.block}` : null, unit?.unitNumber ? `Unit ${unit.unitNumber}` : null]
            .filter(Boolean)
            .join(" - ") || unit?.id || "—",
          amountValue: amount,
          amountLabel: formatCurrencyEGP(amount),
          dueDateRaw: row.dueDate,
          dueDate: formatDate(row.dueDate),
          status: humanizeEnum(row.status),
          reminderSentAt: row.reminderSentAt ? formatDate(row.reminderSentAt) : null,
          overdueNotifiedAt: row.overdueNotifiedAt ? formatDate(row.overdueNotifiedAt) : null,
        } satisfies OwnerInstallmentRow;
      });
      setOwnerInstallments(installmentsRows);
    } catch (error) {
      const msg = errorMessage(error);
      setLoadError(msg);
      toast.error("Failed to load billing data", { description: msg });
    } finally {
      setIsLoading(false);
      setInstallmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBillingData();
  }, [loadBillingData]);

  const selectedResident = useMemo(
    () => residentOptions.find((r) => r.userId === invoiceFormData.residentUserId),
    [residentOptions, invoiceFormData.residentUserId],
  );

  useEffect(() => {
    if (!selectedResident) return;
    if (selectedResident.units.length === 1 && !invoiceFormData.unitId) {
      setInvoiceFormData((prev) => ({ ...prev, unitId: selectedResident.units[0].id }));
    }
  }, [selectedResident, invoiceFormData.unitId]);

  const handleCreateInvoice = async () => {
    if (!invoiceFormData.unitId || !invoiceFormData.type || !invoiceFormData.amount || !invoiceFormData.dueDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post("/invoices", {
        unitId: invoiceFormData.unitId,
        residentId: invoiceFormData.residentUserId || undefined,
        type: invoiceFormData.type,
        amount: Number(invoiceFormData.amount),
        dueDate: new Date(invoiceFormData.dueDate).toISOString(),
      });

      toast.success("Invoice created in backend");
      setIsCreateDialogOpen(false);
      setInvoiceFormData({
        residentUserId: "",
        unitId: "",
        type: "",
        amount: "",
        dueDate: "",
        description: "",
      });
      await loadBillingData();
    } catch (error) {
      toast.error("Failed to create invoice", { description: errorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkInstallmentPaid = async (id: string) => {
    setInstallmentActionId(id);
    try {
      await apiClient.patch(`/owners/payment-plans/installments/${id}/mark-paid`, {
        paidAt: new Date().toISOString(),
      });
      toast.success("Installment marked as paid");
      await loadBillingData();
    } catch (error) {
      toast.error("Failed to mark installment paid", { description: errorMessage(error) });
    } finally {
      setInstallmentActionId(null);
    }
  };

  const handleSendInstallmentReminder = async (id: string) => {
    setInstallmentActionId(id);
    try {
      await apiClient.post(`/owners/payment-plans/installments/${id}/send-reminder`);
      toast.success("Reminder sent");
      await loadBillingData();
    } catch (error) {
      toast.error("Failed to send reminder", { description: errorMessage(error) });
    } finally {
      setInstallmentActionId(null);
    }
  };

  const filteredInvoices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return invoicesData.filter((invoice) => {
      if (!q) return true;
      return (
        invoice.invoiceNumber.toLowerCase().includes(q) ||
        invoice.unitLabel.toLowerCase().includes(q) ||
        invoice.residentLabel.toLowerCase().includes(q) ||
        invoice.type.toLowerCase().includes(q)
      );
    });
  }, [invoicesData, searchTerm]);

  const paidInvoices = useMemo(
    () => invoicesData.filter((i) => i.status.toUpperCase() === "PAID"),
    [invoicesData],
  );
  const pendingInvoices = useMemo(
    () => invoicesData.filter((i) => i.status.toUpperCase() === "PENDING"),
    [invoicesData],
  );
  const overdueInvoices = useMemo(
    () => invoicesData.filter((i) => i.status.toUpperCase() === "OVERDUE"),
    [invoicesData],
  );
  const overdueOwnerInstallments = useMemo(
    () => ownerInstallments.filter((i) => i.status.toUpperCase() === "OVERDUE"),
    [ownerInstallments],
  );

  const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.amountValue, 0);
  const outstandingAmount = pendingInvoices.reduce((sum, i) => sum + i.amountValue, 0);
  const overdueAmount = overdueInvoices.reduce((sum, i) => sum + i.amountValue, 0);
  const collectionRate = invoicesData.length
    ? (paidInvoices.reduce((sum, i) => sum + i.amountValue, 0) /
        Math.max(1, invoicesData.reduce((sum, i) => sum + i.amountValue, 0))) *
      100
    : 0;

  const renderTable = (rows: InvoiceRow[]) => (
    <Table>
      <TableHeader>
        <TableRow className="bg-[#F9FAFB]">
          <TableHead>Invoice ID</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Resident</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Paid Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((invoice) => (
          <TableRow key={invoice.id} className="hover:bg-[#F9FAFB]">
            <TableCell className="font-medium text-[#1E293B]">{invoice.invoiceNumber}</TableCell>
            <TableCell>
              <Badge variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">
                {invoice.unitLabel}
              </Badge>
            </TableCell>
            <TableCell className="text-[#64748B]">{invoice.residentLabel}</TableCell>
            <TableCell className="text-[#1E293B]">{invoice.type}</TableCell>
            <TableCell className="text-[#1E293B]">{invoice.amountLabel}</TableCell>
            <TableCell className="text-[#64748B]">{invoice.dueDate}</TableCell>
            <TableCell>
              <Badge className={getStatusColorClass(invoice.status)}>{invoice.status}</Badge>
            </TableCell>
            <TableCell className="text-[#64748B]">{invoice.paidDate || "—"}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-10 text-[#64748B]">
              No invoices found.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Billing & Payments</h1>
          <p className="text-[#64748B] mt-1">Live invoices and payment status from the backend</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white rounded-lg gap-2">
                <Plus className="w-4 h-4" />
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Invoice</DialogTitle>
                <DialogDescription>Creates a real invoice in the backend database.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invoiceResident">Resident (optional)</Label>
                  <Select
                    value={invoiceFormData.residentUserId}
                    onValueChange={(value) =>
                      setInvoiceFormData((prev) => ({
                        ...prev,
                        residentUserId: value === "none" ? "" : value,
                        unitId: "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select resident" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No resident</SelectItem>
                      {residentOptions.map((resident) => (
                        <SelectItem key={resident.userId} value={resident.userId}>
                          {resident.name} ({resident.email || "no email"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceUnit">Unit</Label>
                  <Select
                    value={invoiceFormData.unitId}
                    onValueChange={(value) => setInvoiceFormData((prev) => ({ ...prev, unitId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedResident?.units ?? residentOptions.flatMap((r) => r.units)).map((unit) => (
                        <SelectItem key={`${unit.id}-${unit.label}`} value={unit.id}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceType">Invoice Type</Label>
                  <Select
                    value={invoiceFormData.type}
                    onValueChange={(value) => setInvoiceFormData((prev) => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {humanizeEnum(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (EGP)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="2500"
                    value={invoiceFormData.amount}
                    onChange={(e) => setInvoiceFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={invoiceFormData.dueDate}
                    onChange={(e) => setInvoiceFormData((prev) => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white"
                  onClick={() => void handleCreateInvoice()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Generate Invoice"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="gap-2 rounded-lg" onClick={() => void loadBillingData()} disabled={isLoading}>
            <Download className="w-4 h-4" />
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {loadError ? (
        <Card className="p-4 border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] rounded-xl">{loadError}</Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Total Revenue (Paid)</p>
              <h3 className="text-[#1E293B]">{formatCurrencyEGP(totalRevenue)}</h3>
              <p className="text-xs text-[#10B981] mt-1">{paidInvoices.length} paid invoices</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-[#10B981]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Outstanding</p>
              <h3 className="text-[#1E293B]">{formatCurrencyEGP(outstandingAmount)}</h3>
              <p className="text-xs text-[#F59E0B] mt-1">{pendingInvoices.length} pending invoices</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-[#F59E0B]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Overdue Amount</p>
              <h3 className="text-[#1E293B]">{formatCurrencyEGP(overdueAmount)}</h3>
              <p className="text-xs text-[#EF4444] mt-1">{overdueInvoices.length} overdue invoices</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-[#EF4444]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Collection Rate</p>
              <h3 className="text-[#1E293B]">{collectionRate.toFixed(1)}%</h3>
              <p className="text-xs text-[#64748B] mt-1">{invoicesData.length} total invoices</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#0B5FFF]/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-[#0B5FFF]" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            <h3 className="text-[#1E293B]">Owner Payment Plan Installments</h3>
            <p className="text-xs text-[#64748B] mt-1">
              Overdue follow-up and manual reminder actions
            </p>
          </div>
          <Badge className={overdueOwnerInstallments.length ? "bg-[#FEF2F2] text-[#991B1B]" : "bg-[#ECFDF5] text-[#166534]"}>
            {overdueOwnerInstallments.length} overdue
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              <TableHead>Owner</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reminder</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ownerInstallments.map((item) => (
              <TableRow key={item.id} className="hover:bg-[#F9FAFB]">
                <TableCell>
                  <div className="text-sm font-medium text-[#1E293B]">{item.ownerName}</div>
                  <div className="text-xs text-[#64748B]">{item.ownerEmail}</div>
                </TableCell>
                <TableCell className="text-[#334155]">{item.unitLabel}</TableCell>
                <TableCell className="text-[#1E293B]">{item.amountLabel}</TableCell>
                <TableCell className="text-[#64748B]">{item.dueDate}</TableCell>
                <TableCell>
                  <Badge className={getStatusColorClass(item.status)}>{item.status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-[#64748B]">
                  {item.reminderSentAt
                    ? `Due reminder: ${item.reminderSentAt}`
                    : item.overdueNotifiedAt
                      ? `Overdue notified: ${item.overdueNotifiedAt}`
                      : "Not sent"}
                </TableCell>
                <TableCell className="text-right">
                  {item.status.toUpperCase() === "PAID" ? (
                    <span className="text-xs text-[#64748B]">No actions</span>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleSendInstallmentReminder(item.id)}
                        disabled={installmentActionId === item.id}
                      >
                        {installmentActionId === item.id ? "Working..." : "Send Reminder"}
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#16A34A] hover:bg-[#16A34A]/90 text-white"
                        onClick={() => void handleMarkInstallmentPaid(item.id)}
                        disabled={installmentActionId === item.id}
                      >
                        {installmentActionId === item.id ? "Working..." : "Mark Paid"}
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!installmentsLoading && ownerInstallments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-[#64748B]">
                  No owner installments found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start border-b border-[#E5E7EB] rounded-none h-12 bg-transparent px-4">
            <TabsTrigger value="all" className="rounded-lg">All Invoices</TabsTrigger>
            <TabsTrigger value="paid" className="rounded-lg">Paid</TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg">Pending</TabsTrigger>
            <TabsTrigger value="overdue" className="rounded-lg">Overdue</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="m-0">
            <div className="p-4 border-b border-[#E5E7EB]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <Input
                  placeholder="Search invoices..."
                  className="pl-10 rounded-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            {renderTable(filteredInvoices)}
          </TabsContent>
          <TabsContent value="paid" className="m-0">{renderTable(paidInvoices)}</TabsContent>
          <TabsContent value="pending" className="m-0">{renderTable(pendingInvoices)}</TabsContent>
          <TabsContent value="overdue" className="m-0">{renderTable(overdueInvoices)}</TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
