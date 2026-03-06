import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Plus, Power, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type DataTableColumn } from '../DataTable';
import { DrawerForm } from '../DrawerForm';
import { EmptyState } from '../EmptyState';
import { PageHeader } from '../PageHeader';
import { SkeletonTable } from '../SkeletonTable';
import { StatCard } from '../StatCard';
import { StatusBadge } from '../StatusBadge';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import gatesService, {
  type GateAccessRole,
  type GateLogItem,
  type GateLogStatusFilter,
  type GateRow,
  type GateStats,
  type QrType,
  GATE_ACCESS_ROLES,
} from '../../lib/gates-service';
import { errorMessage, formatDateTime, humanizeEnum } from '../../lib/live-data';

type GateFormState = {
  name: string;
  code: string;
  allowedRoles: GateAccessRole[];
  etaMinutes: string;
};

const ROLE_BADGE_CLASS: Record<GateAccessRole, string> = {
  RESIDENT: 'bg-blue-100 text-blue-700',
  VISITOR: 'bg-green-100 text-green-700',
  WORKER: 'bg-amber-100 text-amber-700',
  DELIVERY: 'bg-orange-100 text-orange-700',
  STAFF: 'bg-purple-100 text-purple-700',
  RIDESHARE: 'bg-teal-100 text-teal-700',
};

const INITIAL_FORM: GateFormState = {
  name: '',
  code: '',
  allowedRoles: ['VISITOR'],
  etaMinutes: '',
};

const EMPTY_STATS: GateStats = {
  totalGates: 0,
  activeGates: 0,
  currentlyInside: 0,
  todayEntries: 0,
  todayVisitors: 0,
  todayDeliveries: 0,
};

const LOG_PAGE_SIZE = 20;

export function GatesManagement() {
  const [activeTab, setActiveTab] = useState<'gates' | 'log'>('gates');
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isGatesLoading, setIsGatesLoading] = useState(false);
  const [isLogLoading, setIsLogLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [communities, setCommunities] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>('');

  const [gates, setGates] = useState<GateRow[]>([]);
  const [stats, setStats] = useState<GateStats>(EMPTY_STATS);

  const [logFilters, setLogFilters] = useState<{
    gateId: string;
    from: string;
    to: string;
    qrType: string;
    status: string;
    page: number;
  }>({
    gateId: 'all',
    from: '',
    to: '',
    qrType: 'all',
    status: 'all',
    page: 1,
  });

  const [logResult, setLogResult] = useState<{ data: GateLogItem[]; total: number }>({
    data: [],
    total: 0,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGate, setEditingGate] = useState<GateRow | null>(null);
  const [form, setForm] = useState<GateFormState>(INITIAL_FORM);

  const resetForm = () => {
    setEditingGate(null);
    setForm(INITIAL_FORM);
  };

  const openCreate = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (gate: GateRow) => {
    setEditingGate(gate);
    setForm({
      name: gate.name,
      code: gate.code ?? '',
      allowedRoles: gate.allowedRoles,
      etaMinutes: gate.etaMinutes ? String(gate.etaMinutes) : '',
    });
    setDrawerOpen(true);
  };

  const loadStats = useCallback(async (communityId: string) => {
    const summary = await gatesService.getGateStats(communityId);
    setStats(summary);
  }, []);

  const loadGates = useCallback(async (communityId: string) => {
    setIsGatesLoading(true);
    try {
      const rows = await gatesService.listGates({
        communityId,
        includeInactive: true,
      });
      setGates(rows);
    } finally {
      setIsGatesLoading(false);
    }
  }, []);

  const loadLog = useCallback(async () => {
    if (!selectedCommunityId) {
      return;
    }

    setIsLogLoading(true);
    try {
      const response = await gatesService.listGateLog({
        communityId: selectedCommunityId,
        gateId: logFilters.gateId !== 'all' ? logFilters.gateId : undefined,
        from: logFilters.from ? new Date(`${logFilters.from}T00:00:00`).toISOString() : undefined,
        to: logFilters.to ? new Date(`${logFilters.to}T23:59:59.999`).toISOString() : undefined,
        qrType: logFilters.qrType !== 'all' ? (logFilters.qrType as QrType) : undefined,
        status:
          logFilters.status !== 'all' ? (logFilters.status as GateLogStatusFilter) : undefined,
        page: logFilters.page,
        limit: LOG_PAGE_SIZE,
      });

      setLogResult({
        data: response.data,
        total: response.total,
      });
    } catch (error) {
      toast.error('Failed to load gate log', { description: errorMessage(error) });
    } finally {
      setIsLogLoading(false);
    }
  }, [logFilters, selectedCommunityId]);

  const bootstrap = useCallback(async () => {
    setIsBootstrapping(true);
    try {
      const options = await gatesService.listCommunityOptions();
      setCommunities(options);

      const firstCommunityId = options[0]?.id ?? '';
      setSelectedCommunityId(firstCommunityId);
      if (firstCommunityId) {
        await Promise.all([loadGates(firstCommunityId), loadStats(firstCommunityId)]);
      }
    } catch (error) {
      toast.error('Failed to initialize gates page', { description: errorMessage(error) });
    } finally {
      setIsBootstrapping(false);
    }
  }, [loadGates, loadStats]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!selectedCommunityId) {
      return;
    }

    void Promise.all([loadGates(selectedCommunityId), loadStats(selectedCommunityId)]).catch(
      (error: unknown) => {
        toast.error('Failed to refresh gates', { description: errorMessage(error) });
      },
    );
  }, [selectedCommunityId, loadGates, loadStats]);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  const toggleRole = (role: GateAccessRole) => {
    setForm((prev) => {
      const hasRole = prev.allowedRoles.includes(role);
      const nextRoles = hasRole
        ? prev.allowedRoles.filter((value) => value !== role)
        : [...prev.allowedRoles, role];

      return {
        ...prev,
        allowedRoles: nextRoles,
      };
    });
  };

  const saveGate = async () => {
    if (!selectedCommunityId) {
      toast.error('Please select a community first');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Gate name is required');
      return;
    }
    if (form.allowedRoles.length === 0) {
      toast.error('At least one allowed role is required');
      return;
    }

    const eta = form.etaMinutes.trim();
    const etaMinutes = eta ? Number(eta) : undefined;
    if (etaMinutes !== undefined && (!Number.isInteger(etaMinutes) || etaMinutes < 1 || etaMinutes > 120)) {
      toast.error('ETA must be an integer between 1 and 120');
      return;
    }

    setIsSaving(true);
    try {
      if (editingGate) {
        await gatesService.updateGate(editingGate.id, {
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          allowedRoles: form.allowedRoles,
          etaMinutes,
        });
        toast.success('Gate updated');
      } else {
        await gatesService.createGate({
          communityId: selectedCommunityId,
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          allowedRoles: form.allowedRoles,
          etaMinutes,
        });
        toast.success('Gate created');
      }

      setDrawerOpen(false);
      resetForm();
      await Promise.all([loadGates(selectedCommunityId), loadStats(selectedCommunityId)]);
    } catch (error) {
      toast.error('Failed to save gate', { description: errorMessage(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const deactivateGate = async (gate: GateRow) => {
    const confirmed = window.confirm(`Deactivate gate "${gate.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await gatesService.removeGate(gate.id);
      toast.success('Gate deactivated');
      await Promise.all([loadGates(selectedCommunityId), loadStats(selectedCommunityId)]);
    } catch (error) {
      toast.error('Failed to deactivate gate', { description: errorMessage(error) });
    }
  };

  const goToGateLog = (gateId: string) => {
    setActiveTab('log');
    setLogFilters((prev) => ({ ...prev, gateId, page: 1 }));
  };

  const gateColumns: DataTableColumn<GateRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium text-[#0F172A]">{row.name}</span>,
    },
    {
      key: 'code',
      header: 'Code',
      render: (row) => row.code ?? '-',
    },
    {
      key: 'roles',
      header: 'Allowed Roles',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.allowedRoles.map((role) => (
            <Badge key={`${row.id}-${role}`} className={`${ROLE_BADGE_CLASS[role]} border-none`}>
              {humanizeEnum(role)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'eta',
      header: 'ETA',
      render: (row) => (row.etaMinutes ? `${row.etaMinutes} min` : '-'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
            <Pencil className="mr-1 h-4 w-4" />
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => goToGateLog(row.id)}>
            <Eye className="mr-1 h-4 w-4" />
            View Log
          </Button>
          <Button size="sm" variant="outline" className="text-[#B91C1C]" onClick={() => void deactivateGate(row)}>
            <Power className="mr-1 h-4 w-4" />
            Deactivate
          </Button>
        </div>
      ),
    },
  ];

  const logRows = useMemo(
    () =>
      logResult.data.map((row) => {
        const statusLabel = row.checkedInAt && !row.checkedOutAt ? 'INSIDE' : 'EXITED';
        return {
          ...row,
          statusLabel,
        };
      }),
    [logResult.data],
  );

  const logColumns: DataTableColumn<(typeof logRows)[number]>[] = [
    {
      key: 'time',
      header: 'Time',
      render: (row) => (row.checkedInAt ? formatDateTime(row.checkedInAt) : '-'),
    },
    {
      key: 'visitor',
      header: 'Visitor/Worker Name',
      render: (row) => row.visitorName ?? '-',
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (row) => row.unitNumber ?? '-',
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <Badge className="bg-[#E2E8F0] text-[#334155]">{humanizeEnum(row.qrType)}</Badge>,
    },
    {
      key: 'in',
      header: 'Check In',
      render: (row) => (row.checkedInAt ? formatDateTime(row.checkedInAt) : '-'),
    },
    {
      key: 'out',
      header: 'Check Out',
      render: (row) => (row.checkedOutAt ? formatDateTime(row.checkedOutAt) : '-'),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (row) => (row.durationMinutes !== null ? `${row.durationMinutes} min` : '-'),
    },
    {
      key: 'operator',
      header: 'Operator',
      render: (row) => row.gateOperatorName ?? '-',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge value={row.statusLabel} />,
    },
  ];

  const totalLogPages = Math.max(1, Math.ceil(logResult.total / LOG_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gates"
        description="Manage gates and monitor entry activity in real time."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedCommunityId || 'none'} onValueChange={(value) => setSelectedCommunityId(value === 'none' ? '' : value)}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Select community" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select community</SelectItem>
                {communities.map((community) => (
                  <SelectItem key={community.id} value={community.id}>
                    {community.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void bootstrap()} disabled={isBootstrapping}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isBootstrapping ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={openCreate} className="bg-[#0B5FFF] text-white hover:bg-[#0B5FFF]/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Gate
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Total Gates" value={String(stats.totalGates)} icon="devices" />
        <StatCard title="Active Gates" value={String(stats.activeGates)} icon="active-users" />
        <StatCard title="Currently Inside" value={String(stats.currentlyInside)} icon="visitors" />
        <StatCard title="Today's Entries" value={String(stats.todayEntries)} icon="tickets" />
        <StatCard title="Today's Visitors" value={String(stats.todayVisitors)} icon="visitors" />
        <StatCard title="Today's Deliveries" value={String(stats.todayDeliveries)} icon="workers" />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'gates' | 'log')}>
        <TabsList>
          <TabsTrigger value="gates">Gates</TabsTrigger>
          <TabsTrigger value="log">Entry Log</TabsTrigger>
        </TabsList>

        <TabsContent value="gates" className="space-y-4">
          {isGatesLoading ? (
            <SkeletonTable columns={6} rows={6} />
          ) : (
            <DataTable
              columns={gateColumns}
              rows={gates}
              rowKey={(row) => row.id}
              emptyTitle="No gates found"
              emptyDescription="Add a gate to start managing entry points."
            />
          )}
        </TabsContent>

        <TabsContent value="log" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 md:grid-cols-5">
            <div className="space-y-1">
              <Label>Gate</Label>
              <Select
                value={logFilters.gateId}
                onValueChange={(value) =>
                  setLogFilters((prev) => ({ ...prev, gateId: value, page: 1 }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All gates</SelectItem>
                  {gates.map((gate) => (
                    <SelectItem key={gate.id} value={gate.id}>
                      {gate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>From</Label>
              <Input
                type="date"
                value={logFilters.from}
                onChange={(event) =>
                  setLogFilters((prev) => ({ ...prev, from: event.target.value, page: 1 }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label>To</Label>
              <Input
                type="date"
                value={logFilters.to}
                onChange={(event) =>
                  setLogFilters((prev) => ({ ...prev, to: event.target.value, page: 1 }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label>QR Type</Label>
              <Select
                value={logFilters.qrType}
                onValueChange={(value) =>
                  setLogFilters((prev) => ({ ...prev, qrType: value, page: 1 }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="VISITOR">Visitor</SelectItem>
                  <SelectItem value="DELIVERY">Delivery</SelectItem>
                  <SelectItem value="WORKER">Worker</SelectItem>
                  <SelectItem value="RIDESHARE">Rideshare</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={logFilters.status}
                onValueChange={(value) =>
                  setLogFilters((prev) => ({ ...prev, status: value, page: 1 }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="INSIDE">Inside</SelectItem>
                  <SelectItem value="EXITED">Exited</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLogLoading ? (
            <SkeletonTable columns={9} rows={6} />
          ) : logRows.length === 0 ? (
            <EmptyState
              title="No log entries found"
              description="Try changing your gate, date, type, or status filters."
            />
          ) : (
            <>
              <DataTable
                columns={logColumns}
                rows={logRows}
                rowKey={(row) => row.id}
                emptyTitle="No log entries found"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={logFilters.page <= 1}
                  onClick={() =>
                    setLogFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                  }
                >
                  Previous
                </Button>
                <span className="text-sm text-[#64748B]">
                  Page {logFilters.page} / {totalLogPages}
                </span>
                <Button
                  variant="outline"
                  disabled={logFilters.page >= totalLogPages}
                  onClick={() =>
                    setLogFilters((prev) => ({ ...prev, page: Math.min(totalLogPages, prev.page + 1) }))
                  }
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <DrawerForm
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            resetForm();
          }
        }}
        title={editingGate ? 'Edit Gate' : 'Add Gate'}
        description="Configure gate details and allowed roles."
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void saveGate()} disabled={isSaving} className="bg-[#0B5FFF] text-white hover:bg-[#0B5FFF]/90">
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Main Gate"
            />
          </div>

          <div className="space-y-2">
            <Label>Code (optional)</Label>
            <Input
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="GATE_MAIN"
            />
          </div>

          <div className="space-y-2">
            <Label>Allowed Roles</Label>
            <div className="flex flex-wrap gap-2 rounded-md border border-[#E2E8F0] p-3">
              {GATE_ACCESS_ROLES.map((role) => {
                const active = form.allowedRoles.includes(role);
                return (
                  <Button
                    key={role}
                    type="button"
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    className={active ? 'bg-[#0B5FFF] text-white' : ''}
                    onClick={() => toggleRole(role)}
                  >
                    <Badge className={`${ROLE_BADGE_CLASS[role]} border-none`}>{humanizeEnum(role)}</Badge>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>ETA Minutes (1-120)</Label>
            <Input
              type="number"
              min={1}
              max={120}
              value={form.etaMinutes}
              onChange={(event) => setForm((prev) => ({ ...prev, etaMinutes: event.target.value }))}
              placeholder="10"
            />
          </div>
        </div>
      </DrawerForm>
    </div>
  );
}
