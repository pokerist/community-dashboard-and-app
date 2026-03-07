import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Check,
  Eye,
  GripVertical,
  Plus,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '../EmptyState';
import { SkeletonTable } from '../SkeletonTable';
import invoiceService, {
  type CommunityOption,
  type InvoiceCategory,
  type InvoiceDetail,
  type InvoiceListItem,
  type InvoiceStatus,
  type InvoiceStats,
  type InvoiceType,
  type ResidentOption,
  SOURCE_BADGE_COLOR,
  INVOICE_TYPE_OPTIONS,
  type UnitOption,
} from '../../lib/invoiceService';
import { errorMessage } from '../../lib/live-data';

const CARD_CLASS = 'bg-white rounded-xl border border-gray-200 p-6';

const statusClass: Record<string, string> = {
  PAID: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  PENDING: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  OVERDUE: 'bg-red-500/15 text-red-300 border border-red-500/30',
  CANCELLED: 'bg-gray-100 text-gray-700 border border-slate-500/30',
};

const categorySwatches: Array<{ value: string; className: string }> = [
  { value: '#3b82f6', className: 'bg-blue-500' },
  { value: '#10b981', className: 'bg-emerald-500' },
  { value: '#f59e0b', className: 'bg-amber-500' },
  { value: '#ef4444', className: 'bg-red-500' },
  { value: '#8b5cf6', className: 'bg-violet-500' },
  { value: '#f97316', className: 'bg-orange-500' },
  { value: '#14b8a6', className: 'bg-teal-500' },
  { value: '#64748b', className: 'bg-slate-500' },
];

const swatchClassByValue = new Map(
  categorySwatches.map((swatch) => [swatch.value, swatch.className]),
);

const emptyStats: InvoiceStats = {
  totalRevenue: 0,
  pendingAmount: 0,
  overdueAmount: 0,
  overdueCount: 0,
  paidThisMonth: 0,
  invoicesByType: {
    RENT: 0,
    SERVICE_FEE: 0,
    UTILITY: 0,
    FINE: 0,
    MAINTENANCE_FEE: 0,
    BOOKING_FEE: 0,
    SETUP_FEE: 0,
    LATE_FEE: 0,
    MISCELLANEOUS: 0,
    OWNER_EXPENSE: 0,
    MANAGEMENT_FEE: 0,
    CREDIT_MEMO: 0,
    DEBIT_MEMO: 0,
  },
  invoicesByStatus: {
    PAID: 0,
    PENDING: 0,
    OVERDUE: 0,
    CANCELLED: 0,
  },
};

type CreateInvoiceForm = {
  unitId: string;
  residentId: string;
  type: InvoiceType;
  amount: string;
  dueDate: string;
};

type CreateCategoryForm = {
  label: string;
  description: string;
  color: string;
};

function enumLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCurrency(value: number): string {
  return `EGP ${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-GB');
}

function formatDateTime(value: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('en-GB');
}

export function BillingPayments() {
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [stats, setStats] = useState<InvoiceStats>(emptyStats);
  const [rows, setRows] = useState<InvoiceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  const [filters, setFilters] = useState<{
    search: string;
    status: string;
    type: string;
    fromDate: string;
    toDate: string;
    communityId: string;
  }>({
    search: '',
    status: 'all',
    type: 'all',
    fromDate: '',
    toDate: '',
    communityId: 'all',
  });

  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [residents, setResidents] = useState<ResidentOption[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState<CreateInvoiceForm>({
    unitId: '',
    residentId: '',
    type: 'RENT',
    amount: '',
    dueDate: '',
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [categories, setCategories] = useState<InvoiceCategory[]>([]);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CreateCategoryForm>({
    label: '',
    description: '',
    color: categorySwatches[0].value,
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadBaseOptions = useCallback(async () => {
    const [communityOptions, unitOptions, residentOptions] = await Promise.all([
      invoiceService.listCommunityOptions(),
      invoiceService.listUnitOptions(),
      invoiceService.listResidentOptions(),
    ]);

    setCommunities(communityOptions);
    setUnits(unitOptions);
    setResidents(residentOptions);
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await invoiceService.listCategories(true);
    setCategories(data);
  }, []);

  const loadStats = useCallback(async () => {
    const data = await invoiceService.getInvoiceStats(
      filters.communityId !== 'all'
        ? { communityId: filters.communityId }
        : undefined,
    );
    setStats(data);
  }, [filters.communityId]);

  const loadInvoices = useCallback(async () => {
    setTableLoading(true);
    try {
      const response = await invoiceService.listInvoices({
        page,
        limit,
        search: filters.search.trim() || undefined,
        status:
          filters.status !== 'all'
            ? (filters.status as InvoiceStatus)
            : undefined,
        type:
          filters.type !== 'all' ? (filters.type as InvoiceType) : undefined,
        createdFrom: filters.fromDate
          ? new Date(`${filters.fromDate}T00:00:00.000Z`).toISOString()
          : undefined,
        createdTo: filters.toDate
          ? new Date(`${filters.toDate}T23:59:59.999Z`).toISOString()
          : undefined,
        communityId:
          filters.communityId !== 'all' ? filters.communityId : undefined,
      });

      setRows(response.data);
      setTotal(response.total);
    } catch (error) {
      toast.error('Failed to load invoices', {
        description: errorMessage(error),
      });
    } finally {
      setTableLoading(false);
    }
  }, [
    filters.communityId,
    filters.fromDate,
    filters.search,
    filters.status,
    filters.toDate,
    filters.type,
    limit,
    page,
  ]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadBaseOptions(),
        loadCategories(),
        loadStats(),
        loadInvoices(),
      ]);
    } catch (error) {
      toast.error('Failed to initialize invoices page', {
        description: errorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, [loadBaseOptions, loadCategories, loadInvoices, loadStats]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const refreshData = useCallback(async () => {
    await Promise.all([loadStats(), loadInvoices()]);
  }, [loadInvoices, loadStats]);

  const openDetail = useCallback(async (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const response = await invoiceService.getInvoiceDetail(invoiceId);
      setDetail(response);
    } catch (error) {
      toast.error('Failed to load invoice details', {
        description: errorMessage(error),
      });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const submitCreateInvoice = useCallback(async () => {
    if (!createForm.unitId || !createForm.amount || !createForm.dueDate) {
      toast.error('Unit, amount, and due date are required');
      return;
    }

    const amount = Number(createForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }

    setCreateSubmitting(true);
    try {
      await invoiceService.createInvoice({
        unitId: createForm.unitId,
        residentId: createForm.residentId || undefined,
        type: createForm.type,
        amount,
        dueDate: new Date(`${createForm.dueDate}T00:00:00.000Z`).toISOString(),
      });
      toast.success('Invoice created');
      setCreateOpen(false);
      setCreateForm({
        unitId: '',
        residentId: '',
        type: 'RENT',
        amount: '',
        dueDate: '',
      });
      await refreshData();
    } catch (error) {
      toast.error('Failed to create invoice', {
        description: errorMessage(error),
      });
    } finally {
      setCreateSubmitting(false);
    }
  }, [
    createForm.amount,
    createForm.dueDate,
    createForm.residentId,
    createForm.type,
    createForm.unitId,
    refreshData,
  ]);

  const markAsPaid = useCallback(
    async (invoiceId: string) => {
      try {
        await invoiceService.markAsPaid(invoiceId);
        toast.success('Invoice marked as paid');
        await refreshData();
        if (selectedInvoiceId === invoiceId) {
          await openDetail(invoiceId);
        }
      } catch (error) {
        toast.error('Failed to mark invoice as paid', {
          description: errorMessage(error),
        });
      }
    },
    [openDetail, refreshData, selectedInvoiceId],
  );

  const cancelInvoice = useCallback(
    async (invoiceId: string) => {
      const reason = window.prompt('Cancellation reason');
      if (!reason || !reason.trim()) {
        return;
      }

      try {
        await invoiceService.cancelInvoice(invoiceId, reason.trim());
        toast.success('Invoice cancelled');
        await refreshData();
        if (selectedInvoiceId === invoiceId) {
          await openDetail(invoiceId);
        }
      } catch (error) {
        toast.error('Failed to cancel invoice', {
          description: errorMessage(error),
        });
      }
    },
    [openDetail, refreshData, selectedInvoiceId],
  );

  const bulkMarkOverdue = useCallback(async () => {
    try {
      const response = await invoiceService.bulkMarkOverdue();
      toast.success(`Marked ${response.updatedCount} invoice(s) overdue`);
      await refreshData();
    } catch (error) {
      toast.error('Failed to mark overdue invoices', {
        description: errorMessage(error),
      });
    }
  }, [refreshData]);

  const submitCategory = useCallback(async () => {
    if (!categoryForm.label.trim()) {
      toast.error('Category label is required');
      return;
    }

    setCategorySubmitting(true);
    try {
      await invoiceService.createCategory({
        label: categoryForm.label.trim(),
        description: categoryForm.description.trim() || undefined,
        color: categoryForm.color,
      });
      toast.success('Category added');
      setCategoryDrawerOpen(false);
      setCategoryForm({
        label: '',
        description: '',
        color: categorySwatches[0].value,
      });
      await loadCategories();
    } catch (error) {
      toast.error('Failed to add category', {
        description: errorMessage(error),
      });
    } finally {
      setCategorySubmitting(false);
    }
  }, [
    categoryForm.color,
    categoryForm.description,
    categoryForm.label,
    loadCategories,
  ]);

  const moveCategory = useCallback(
    async (index: number, direction: -1 | 1) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= categories.length) {
        return;
      }
      const reordered = [...categories];
      const [item] = reordered.splice(index, 1);
      reordered.splice(nextIndex, 0, item);

      try {
        setCategories(reordered);
        await invoiceService.reorderCategories(reordered.map((row) => row.id));
      } catch (error) {
        toast.error('Failed to reorder categories', {
          description: errorMessage(error),
        });
        await loadCategories();
      }
    },
    [categories, loadCategories],
  );

  const filteredUnits = useMemo(() => {
    if (filters.communityId === 'all') {
      return units;
    }
    return units.filter((unit) => unit.communityId === filters.communityId);
  }, [filters.communityId, units]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Payments & Invoices
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track invoices, collections, and category settings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="bg-white/5 hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="w-4 h-4" />
            Categories
          </button>
          <button
            className="bg-black hover:bg-black/90 border border-black text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            style={{ backgroundColor: '#000000', color: '#ffffff' }}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:border-gray-300 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Revenue
            </p>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center" />
          </div>
          <p className="text-3xl font-semibold text-emerald-400 font-['DM_Mono']">
            {formatCurrency(stats.totalRevenue)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Paid invoices</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:border-gray-300 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pending Amount
            </p>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center" />
          </div>
          <p className="text-3xl font-semibold text-gray-900 font-['DM_Mono']">
            {formatCurrency(stats.pendingAmount)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Awaiting payment</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:border-gray-300 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Overdue Amount
            </p>
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center" />
          </div>
          <p className="text-3xl font-semibold text-gray-900 font-['DM_Mono']">
            {formatCurrency(stats.overdueAmount)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Past due invoices</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:border-gray-300 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Overdue Count
            </p>
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center" />
          </div>
          <p
            className={`text-3xl font-semibold font-['DM_Mono'] ${stats.overdueCount > 0 ? 'text-red-400' : 'text-gray-900'}`}
          >
            {stats.overdueCount.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Current overdue invoices
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-500/50"
              placeholder="Search..."
              value={filters.search}
              onChange={(event) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, search: event.target.value }));
              }}
            />
          </div>

          <select
            className="w-40 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none"
            value={filters.status}
            onChange={(event) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, status: event.target.value }));
            }}
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            className="w-48 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none"
            value={filters.type}
            onChange={(event) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, type: event.target.value }));
            }}
          >
            <option value="all">All Types</option>
            {INVOICE_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {enumLabel(type)}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="w-36 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50"
            value={filters.fromDate}
            onChange={(event) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, fromDate: event.target.value }));
            }}
          />
          <input
            type="date"
            className="w-36 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50"
            value={filters.toDate}
            onChange={(event) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, toDate: event.target.value }));
            }}
          />

          <select
            className="w-48 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none"
            value={filters.communityId}
            onChange={(event) => {
              setPage(1);
              setFilters((prev) => ({
                ...prev,
                communityId: event.target.value,
              }));
            }}
          >
            <option value="all">All Communities</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.label}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2">
            <button
              className="bg-white/5 hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              onClick={() => void bulkMarkOverdue()}
            >
              Mark Overdue
            </button>
            <button
              className="bg-black hover:bg-black/90 border border-black text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              style={{ backgroundColor: '#000000', color: '#ffffff' }}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4" /> Create Invoice
            </button>
          </div>
        </div>

        {loading || tableLoading ? (
          <div className="p-6">
            <SkeletonTable columns={9} rows={8} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No invoices found"
              description="Try changing status, type, date, or search filters."
            />
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    {[
                      'Invoice #',
                      'Unit',
                      'Resident',
                      'Category',
                      'Amount',
                      'Due Date',
                      'Status',
                      'Source',
                      'Actions',
                    ].map((column) => (
                      <th
                        key={column}
                        className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-200 hover:bg-white/[0.02] transition-colors last:border-0 ${row.status === 'OVERDUE' ? 'border-l-2 border-red-500/40' : ''}`}
                    >
                      <td className="py-4 px-4 text-sm text-gray-700 font-['DM_Mono']">
                        {row.invoiceNumber}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {row.unitNumber}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {row.residentName || '--'}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {row.categoryLabel || '--'}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700 text-right font-['DM_Mono']">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {formatDate(row.dueDate)}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full ${statusClass[row.status] || statusClass.CANCELLED}`}
                        >
                          {enumLabel(row.status)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full ${SOURCE_BADGE_COLOR[row.source]}`}
                        >
                          {enumLabel(row.source)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <button
                            className="p-2 rounded-lg bg-white/5 hover:bg-gray-100"
                            onClick={() => void openDetail(row.id)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {row.status === 'PENDING' ||
                          row.status === 'OVERDUE' ? (
                            <button
                              className="p-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300"
                              onClick={() => void markAsPaid(row.id)}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          ) : null}
                          {row.status !== 'PAID' &&
                          row.status !== 'CANCELLED' ? (
                            <button
                              className="p-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300"
                              onClick={() => void cancelInvoice(row.id)}
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                className="bg-white/5 hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                className="bg-white/5 hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {detailOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] bg-white border border-slate-200 rounded-xl flex flex-col z-50 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-semibold text-slate-900">
                Invoice Detail
              </h2>
              <button
                className="p-2 rounded-lg hover:bg-white text-gray-400 hover:text-slate-700"
                onClick={() => setDetailOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {detailLoading || !detail ? (
                <SkeletonTable columns={2} rows={6} />
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <p className="text-2xl font-semibold text-slate-900 font-['DM_Mono']">
                      {detail.invoiceNumber}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full ${statusClass[detail.status] || statusClass.CANCELLED}`}
                      >
                        {enumLabel(detail.status)}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full ${SOURCE_BADGE_COLOR[detail.source]}`}
                      >
                        {enumLabel(detail.source)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      Parties
                    </p>
                    <p className="text-sm text-slate-800">
                      Unit: {detail.parties.unitNumber}
                    </p>
                    <p className="text-sm text-slate-800">
                      Resident: {detail.parties.residentName || '--'}
                    </p>
                    <p className="text-sm text-slate-800">
                      Phone: {detail.parties.residentPhone || '--'}
                    </p>
                    <p className="text-sm text-gray-400">
                      Community: {detail.parties.communityName}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      Amount
                    </p>
                    <p className="text-2xl font-semibold text-slate-900 font-['DM_Mono']">
                      {formatCurrency(detail.amount)}
                    </p>
                    <p className="text-sm text-slate-700 mt-2">
                      Due: {formatDate(detail.dueDate)}
                    </p>
                    <p className="text-sm text-slate-700">
                      Paid: {formatDate(detail.paidDate)}
                    </p>
                    <p className="text-sm text-slate-700 mt-1 flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${swatchClassByValue.get(detail.categoryColor || '') || 'bg-slate-500'}`}
                      />
                      {detail.categoryLabel || '--'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      Source Record
                    </p>
                    <p className="text-sm text-slate-800">
                      {detail.sourceRecord.label}
                    </p>
                    <p className="text-sm text-gray-400">
                      {detail.sourceRecord.secondaryLabel || 'Manually created'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Amount:{' '}
                      {detail.sourceRecord.amount !== null
                        ? formatCurrency(detail.sourceRecord.amount)
                        : '--'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                      Documents
                    </p>
                    {detail.documents.length === 0 ? (
                      <p className="text-sm text-gray-400">
                        No documents attached.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {detail.documents.map((document) => (
                          <div
                            key={document.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200"
                          >
                            <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-gray-400">
                              FILE
                            </div>
                            <div>
                              <p className="text-sm text-slate-800">
                                {document.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {document.mimeType || 'Unknown type'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
              {detail &&
              (detail.status === 'PENDING' || detail.status === 'OVERDUE') ? (
                <>
                  <button
                    className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    onClick={() => detail && void cancelInvoice(detail.id)}
                  >
                    Cancel
                  </button>
                  <button
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    onClick={() => detail && void markAsPaid(detail.id)}
                  >
                    Mark as Paid
                  </button>
                </>
              ) : detail && detail.status === 'PAID' ? (
                <p className="text-sm text-emerald-600">
                  Paid on {formatDate(detail.paidDate)}
                </p>
              ) : (
                <p className="text-sm text-gray-400">Cancelled</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] bg-white border border-slate-200 rounded-xl flex flex-col z-50 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-semibold text-slate-900">
                Create Invoice
              </h2>
              <button
                className="p-2 rounded-lg hover:bg-white text-gray-400 hover:text-slate-700"
                onClick={() => setCreateOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Community
                </label>
                <select
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  value={filters.communityId}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      communityId: event.target.value,
                    }))
                  }
                >
                  <option value="all">All Communities</option>
                  {communities.map((community) => (
                    <option key={community.id} value={community.id}>
                      {community.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Unit
                </label>
                <select
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  value={createForm.unitId}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      unitId: event.target.value,
                    }))
                  }
                >
                  <option value="">Select Unit</option>
                  {filteredUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Resident (Optional)
                </label>
                <select
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  value={createForm.residentId}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      residentId: event.target.value,
                    }))
                  }
                >
                  <option value="">No Resident</option>
                  {residents.map((resident) => (
                    <option key={resident.id} value={resident.id}>
                      {resident.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                    Type
                  </label>
                  <select
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    value={createForm.type}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        type: event.target.value as InvoiceType,
                      }))
                    }
                  >
                    {INVOICE_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {enumLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                    Amount
                  </label>
                  <input
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                    type="number"
                    min={0}
                    value={createForm.amount}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        amount: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Due Date
                </label>
                <input
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  type="date"
                  value={createForm.dueDate}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      dueDate: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                className="bg-black hover:bg-black/90 border border-black text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                style={{ backgroundColor: '#000000', color: '#ffffff' }}
                onClick={() => void submitCreateInvoice()}
                disabled={createSubmitting}
              >
                {createSubmitting ? 'Saving...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-y-auto"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(1px)' }}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-[960px] max-w-[calc(100vw-48px)] mt-8 rounded-xl border border-gray-300 shadow-2xl shadow-black/60 overflow-hidden"
            style={{ backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#e2e8f0' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderBottomColor: '#e2e8f0' }}>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: '#0f172a' }}>
                  Invoice Categories
                </h2>
                <p className="text-sm" style={{ color: '#475569' }}>
                  Review system categories and add your own custom categories.
                </p>
              </div>
              <button
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                onClick={() => setCategoryDrawerOpen(true)}
              >
                <Plus className="w-4 h-4" /> Add Category
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
              {categories.length === 0 ? (
                <div
                  className="rounded-xl border p-6 text-center"
                  style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
                >
                  <h3 className="text-base font-semibold" style={{ color: '#0f172a' }}>
                    No categories configured
                  </h3>
                  <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: '#475569' }}>
                    System categories are auto-created from invoice types. Add
                    your own custom categories for manual billing workflows.
                  </p>
                </div>
              ) : (
                categories.map((category, index) => (
                  <div
                    key={category.id}
                    className="border rounded-lg px-4 py-3 flex items-center gap-3"
                    style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}
                  >
                    <span
                      className={`w-3 h-3 rounded-full ${swatchClassByValue.get(category.color || '') || 'bg-slate-500'}`}
                    />
                    <div className="min-w-[180px]">
                      <p className="text-sm font-medium" style={{ color: '#0f172a' }}>
                        {category.label}
                      </p>
                      <p className="text-xs" style={{ color: '#64748b' }}>
                        {category.description || '--'}
                      </p>
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full"
                      style={{ color: '#334155', backgroundColor: '#f1f5f9' }}
                    >
                      {category.isSystem
                        ? `System - ${enumLabel(category.mappedType)}`
                        : 'Custom'}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        className="p-2 rounded-lg"
                        style={{ color: '#334155', backgroundColor: '#f8fafc' }}
                        onClick={() => void moveCategory(index, -1)}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 rounded-lg"
                        style={{ color: '#334155', backgroundColor: '#f8fafc' }}
                        onClick={() => void moveCategory(index, 1)}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={
                          category.isActive
                            ? { backgroundColor: 'rgba(16, 185, 129, 0.16)', color: '#86efac' }
                            : { backgroundColor: 'rgba(100, 116, 139, 0.24)', color: '#cbd5e1' }
                        }
                        onClick={() =>
                          void invoiceService
                            .toggleCategory(category.id)
                            .then(loadCategories)
                        }
                      >
                        {category.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <GripVertical className="w-4 h-4" style={{ color: '#94a3b8' }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {categoryDrawerOpen ? (
        <div
          className="fixed inset-0 z-[60] bg-black/50"
          onClick={() => setCategoryDrawerOpen(false)}
        >
          <div
            className="fixed inset-y-0 right-0 w-[480px] border-l border-gray-200 flex flex-col z-[61] shadow-2xl shadow-black/50"
            style={{ backgroundColor: '#ffffff', borderLeftColor: '#e2e8f0' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderBottomColor: '#e2e8f0' }}>
              <h2 className="text-base font-semibold" style={{ color: '#0f172a' }}>
                Add Category
              </h2>
              <button
                className="p-2 rounded-lg hover:bg-white"
                style={{ color: '#475569' }}
                onClick={() => setCategoryDrawerOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#334155' }}>
                  Label
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }}
                  value={categoryForm.label}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      label: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#334155' }}>
                  Description
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                  style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#0f172a' }}
                  rows={4}
                  value={categoryForm.description}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#334155' }}>
                  Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {categorySwatches.map((swatch) => (
                    <button
                      key={swatch.value}
                      className={`w-8 h-8 rounded-full border ${swatch.className} ${categoryForm.color === swatch.value ? 'border-white' : 'border-white/20'}`}
                      onClick={() =>
                        setCategoryForm((prev) => ({
                          ...prev,
                          color: swatch.value,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-3" style={{ borderTopColor: '#e2e8f0' }}>
              <button
                className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                style={{ backgroundColor: '#ffffff', color: '#334155', border: '1px solid #cbd5e1' }}
                onClick={() => setCategoryDrawerOpen(false)}
              >
                Cancel
              </button>
              <button
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                onClick={() => void submitCategory()}
                disabled={categorySubmitting}
              >
                {categorySubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
