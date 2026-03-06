import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, Plus, RefreshCw, Trash2, X } from 'lucide-react';
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
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import blueCollarService, {
  type BlueCollarHoliday,
  type BlueCollarSettings,
  type BlueCollarTerms,
  type BlueCollarWorker,
  type BlueCollarWorkerDetail,
  type BlueCollarWorkerStats,
  type EntityStatus,
} from '../../lib/blue-collar-service';
import { errorMessage, formatDateTime, humanizeEnum } from '../../lib/live-data';

type DayToggle = {
  label: string;
  value: number;
};

const DAY_TOGGLES: DayToggle[] = [
  { label: 'S', value: 0 },
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'T', value: 4 },
  { label: 'F', value: 5 },
  { label: 'S', value: 6 },
];

const EMPTY_STATS: BlueCollarWorkerStats = {
  totalWorkers: 0,
  activeWorkers: 0,
  pendingApproval: 0,
  contractorCount: 0,
};

export function BlueCollarManagement() {
  const [activeTab, setActiveTab] = useState<'workers' | 'settings' | 'terms'>('workers');

  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isWorkersLoading, setIsWorkersLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingTerms, setIsSavingTerms] = useState(false);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  const [communities, setCommunities] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');

  const [workers, setWorkers] = useState<BlueCollarWorker[]>([]);
  const [stats, setStats] = useState<BlueCollarWorkerStats>(EMPTY_STATS);

  const [settings, setSettings] = useState<BlueCollarSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<{
    workingHoursStart: string;
    workingHoursEnd: string;
    allowedDays: number[];
  }>({
    workingHoursStart: '07:00',
    workingHoursEnd: '18:00',
    allowedDays: [1, 2, 3, 4, 5],
  });

  const [holidays, setHolidays] = useState<BlueCollarHoliday[]>([]);
  const [newHoliday, setNewHoliday] = useState<{ date: string; label: string }>({
    date: '',
    label: '',
  });

  const [terms, setTerms] = useState<BlueCollarTerms>({
    terms: '',
    version: 1,
    updatedAt: null,
  });
  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [termsDraft, setTermsDraft] = useState('');

  const [filters, setFilters] = useState<{
    contractorId: string;
    status: string;
    search: string;
  }>({
    contractorId: 'all',
    status: 'all',
    search: '',
  });

  const [workerDetailOpen, setWorkerDetailOpen] = useState(false);
  const [workerDetail, setWorkerDetail] = useState<BlueCollarWorkerDetail | null>(null);

  const contractorOptions = useMemo(() => {
    const unique = new Map<string, string>();
    workers.forEach((worker) => {
      if (!unique.has(worker.contractorName)) {
        unique.set(worker.contractorName, worker.contractorName);
      }
    });
    return Array.from(unique.values());
  }, [workers]);

  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const aPending = a.accessProfileStatus === 'PENDING' ? 1 : 0;
      const bPending = b.accessProfileStatus === 'PENDING' ? 1 : 0;
      if (aPending !== bPending) {
        return bPending - aPending;
      }
      return a.fullName.localeCompare(b.fullName);
    });
  }, [workers]);

  const filteredWorkers = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return sortedWorkers.filter((worker) => {
      const matchesContractor =
        filters.contractorId === 'all' || worker.contractorName === filters.contractorId;
      const matchesStatus = filters.status === 'all' || worker.status === filters.status;
      const matchesSearch =
        search.length === 0 ||
        worker.fullName.toLowerCase().includes(search) ||
        worker.nationalId.toLowerCase().includes(search);

      return matchesContractor && matchesStatus && matchesSearch;
    });
  }, [filters, sortedWorkers]);

  const loadWorkers = useCallback(async () => {
    if (!selectedCommunityId) {
      setWorkers([]);
      return;
    }

    setIsWorkersLoading(true);
    try {
      const allWorkers = await blueCollarService.listWorkers({
        communityId: selectedCommunityId,
        limit: 100,
      });
      setWorkers(allWorkers.data);
    } catch (error) {
      toast.error('Failed to load workers', { description: errorMessage(error) });
    } finally {
      setIsWorkersLoading(false);
    }
  }, [selectedCommunityId]);

  const loadStats = useCallback(async () => {
    if (!selectedCommunityId) {
      setStats(EMPTY_STATS);
      return;
    }

    try {
      const response = await blueCollarService.getWorkerStats(selectedCommunityId);
      setStats(response);
    } catch (error) {
      toast.error('Failed to load worker stats', { description: errorMessage(error) });
    }
  }, [selectedCommunityId]);

  const loadSettings = useCallback(async () => {
    if (!selectedCommunityId) {
      setSettings(null);
      return;
    }

    try {
      const response = await blueCollarService.getSettings(selectedCommunityId);
      setSettings(response);
      if (response) {
        setSettingsForm({
          workingHoursStart: response.workingHoursStart,
          workingHoursEnd: response.workingHoursEnd,
          allowedDays: response.allowedDays,
        });
      }
    } catch (error) {
      toast.error('Failed to load settings', { description: errorMessage(error) });
    }
  }, [selectedCommunityId]);

  const loadHolidays = useCallback(async () => {
    if (!selectedCommunityId) {
      setHolidays([]);
      return;
    }

    try {
      const currentYear = new Date().getFullYear();
      const response = await blueCollarService.listHolidays(selectedCommunityId, currentYear);
      setHolidays(response);
    } catch (error) {
      toast.error('Failed to load holidays', { description: errorMessage(error) });
    }
  }, [selectedCommunityId]);

  const loadTerms = useCallback(async () => {
    if (!selectedCommunityId) {
      setTerms({ terms: '', version: 1, updatedAt: null });
      return;
    }

    try {
      const response = await blueCollarService.getTerms(selectedCommunityId);
      setTerms(response);
      setTermsDraft(response.terms);
    } catch (error) {
      toast.error('Failed to load terms', { description: errorMessage(error) });
    }
  }, [selectedCommunityId]);

  const bootstrap = useCallback(async () => {
    setIsBootstrapping(true);
    try {
      const communityOptions = await blueCollarService.listCommunityOptions();
      setCommunities(communityOptions);
      const firstCommunity = communityOptions[0]?.id ?? '';
      setSelectedCommunityId(firstCommunity);
    } catch (error) {
      toast.error('Failed to initialize page', { description: errorMessage(error) });
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!selectedCommunityId) {
      return;
    }

    void Promise.all([loadWorkers(), loadStats(), loadSettings(), loadHolidays(), loadTerms()]);
  }, [selectedCommunityId, loadWorkers, loadStats, loadSettings, loadHolidays, loadTerms]);

  const saveSettings = async () => {
    if (!selectedCommunityId) {
      toast.error('Select a community first');
      return;
    }

    setIsSavingSettings(true);
    try {
      const response = await blueCollarService.upsertSettings(selectedCommunityId, settingsForm);
      setSettings(response);
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings', { description: errorMessage(error) });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const addHoliday = async () => {
    if (!selectedCommunityId || !newHoliday.date || !newHoliday.label.trim()) {
      toast.error('Holiday date and label are required');
      return;
    }

    setIsSavingHoliday(true);
    try {
      await blueCollarService.addHoliday(selectedCommunityId, {
        date: newHoliday.date,
        label: newHoliday.label.trim(),
      });
      setNewHoliday({ date: '', label: '' });
      await loadHolidays();
      toast.success('Holiday added');
    } catch (error) {
      toast.error('Failed to add holiday', { description: errorMessage(error) });
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const removeHoliday = async (holiday: BlueCollarHoliday) => {
    const confirmed = window.confirm(`Remove holiday "${holiday.label}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await blueCollarService.removeHoliday(holiday.id);
      await loadHolidays();
      toast.success('Holiday removed');
    } catch (error) {
      toast.error('Failed to remove holiday', { description: errorMessage(error) });
    }
  };

  const saveTerms = async () => {
    if (!selectedCommunityId || !termsDraft.trim()) {
      toast.error('Terms cannot be empty');
      return;
    }

    setIsSavingTerms(true);
    try {
      const response = await blueCollarService.updateTerms(selectedCommunityId, termsDraft.trim());
      setTerms(response);
      setIsEditingTerms(false);
      toast.success('Terms updated');
    } catch (error) {
      toast.error('Failed to update terms', { description: errorMessage(error) });
    } finally {
      setIsSavingTerms(false);
    }
  };

  const openWorkerDetail = async (workerId: string) => {
    try {
      const detail = await blueCollarService.getWorkerDetail(workerId);
      setWorkerDetail(detail);
      setWorkerDetailOpen(true);
    } catch (error) {
      toast.error('Failed to load worker detail', { description: errorMessage(error) });
    }
  };

  const approveWorker = async (accessProfileId: string) => {
    const confirmed = window.confirm('Approve this worker access profile?');
    if (!confirmed) {
      return;
    }

    try {
      await blueCollarService.approveWorkerAccess(accessProfileId);
      toast.success('Worker approved');
      await Promise.all([loadWorkers(), loadStats()]);
      if (workerDetail?.accessProfileId === accessProfileId) {
        const refreshed = await blueCollarService.getWorkerDetail(workerDetail.id);
        setWorkerDetail(refreshed);
      }
    } catch (error) {
      toast.error('Failed to approve worker', { description: errorMessage(error) });
    }
  };

  const rejectWorker = async (accessProfileId: string) => {
    const reason = window.prompt('Rejection reason');
    if (!reason || !reason.trim()) {
      return;
    }

    try {
      await blueCollarService.rejectWorkerAccess(accessProfileId, reason.trim());
      toast.success('Worker rejected');
      await Promise.all([loadWorkers(), loadStats()]);
      if (workerDetail?.accessProfileId === accessProfileId) {
        const refreshed = await blueCollarService.getWorkerDetail(workerDetail.id);
        setWorkerDetail(refreshed);
      }
    } catch (error) {
      toast.error('Failed to reject worker', { description: errorMessage(error) });
    }
  };

  const workerColumns: DataTableColumn<BlueCollarWorker>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className={`pl-3 ${row.accessProfileStatus === 'PENDING' ? 'border-l-4 border-l-amber-500' : ''}`}>
          <div className="font-medium text-[#0F172A]">{row.fullName}</div>
        </div>
      ),
    },
    {
      key: 'nationalId',
      header: 'National ID',
      render: (row) => row.nationalId,
    },
    {
      key: 'jobType',
      header: 'Job Type',
      render: (row) => row.jobType ?? '-',
    },
    {
      key: 'contractor',
      header: 'Contractor',
      render: (row) => row.contractorName,
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (row) => row.unitNumber,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge value={row.accessProfileStatus} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void openWorkerDetail(row.id)}>
            <Eye className="mr-1 h-4 w-4" />
            View Details
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void approveWorker(row.accessProfileId)}
                disabled={row.accessProfileStatus !== 'PENDING'}
              >
                <Check className="mr-1 h-4 w-4" />
                Approve
              </Button>
            </TooltipTrigger>
            <TooltipContent>Approve without opening drawer</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-[#B91C1C]"
                onClick={() => void rejectWorker(row.accessProfileId)}
                disabled={row.accessProfileStatus !== 'PENDING'}
              >
                <X className="mr-1 h-4 w-4" />
                Reject
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reject with reason prompt</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ];

  const toggleDay = (dayValue: number) => {
    setSettingsForm((prev) => {
      const exists = prev.allowedDays.includes(dayValue);
      return {
        ...prev,
        allowedDays: exists
          ? prev.allowedDays.filter((value) => value !== dayValue)
          : [...prev.allowedDays, dayValue],
      };
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blue Collar"
        description="Manage worker approvals, calendar settings, and terms & conditions."
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
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Workers" value={String(stats.totalWorkers)} icon="workers" />
        <StatCard title="Active" value={String(stats.activeWorkers)} icon="active-users" />
        <StatCard title="Pending Approval" value={String(stats.pendingApproval)} icon="tickets" />
        <StatCard title="Contractors" value={String(stats.contractorCount)} icon="occupancy" />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'workers' | 'settings' | 'terms')}>
        <TabsList>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="terms">Terms & Conditions</TabsTrigger>
        </TabsList>

        <TabsContent value="workers" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 md:grid-cols-4">
            <Select
              value={filters.contractorId}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, contractorId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Contractor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contractors</SelectItem>
                {contractorOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {(['ACTIVE', 'INACTIVE', 'SUSPENDED'] as EntityStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {humanizeEnum(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Search name or national ID"
            />

            <div className="text-sm text-[#64748B] flex items-center">
              Pending workers are pinned to the top.
            </div>
          </div>

          {isWorkersLoading ? (
            <SkeletonTable columns={7} rows={8} />
          ) : (
            <DataTable
              columns={workerColumns}
              rows={filteredWorkers}
              rowKey={(row) => row.id}
              emptyTitle="No workers found"
              emptyDescription="No workers match the selected filters."
            />
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="space-y-4 p-5">
              <div>
                <h3 className="text-[#0F172A]">Working Hours & Days</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={settingsForm.workingHoursStart}
                    onChange={(event) =>
                      setSettingsForm((prev) => ({ ...prev, workingHoursStart: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={settingsForm.workingHoursEnd}
                    onChange={(event) =>
                      setSettingsForm((prev) => ({ ...prev, workingHoursEnd: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Allowed Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAY_TOGGLES.map((day, index) => {
                    const active = settingsForm.allowedDays.includes(day.value);
                    return (
                      <button
                        key={`${day.value}-${index}`}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`h-9 w-9 rounded-md border text-sm font-semibold ${
                          active
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-[#334155] bg-white/5 text-[#334155]'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button onClick={() => void saveSettings()} disabled={isSavingSettings} className="bg-[#0B5FFF] text-white hover:bg-[#0B5FFF]/90">
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </Button>
            </Card>

            <Card className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[#0F172A]">Holiday Calendar</h3>
                <Badge className="bg-[#E2E8F0] text-[#334155] border-none">{new Date().getFullYear()}</Badge>
              </div>

              <div className="space-y-2">
                {holidays.length === 0 ? (
                  <EmptyState title="No holidays" description="Add holidays for this year." />
                ) : (
                  holidays.map((holiday) => (
                    <div key={holiday.id} className="flex items-center justify-between rounded-md border border-[#E2E8F0] p-3">
                      <div>
                        <div className="text-sm font-medium text-[#0F172A]">{holiday.label}</div>
                        <div className="text-xs text-[#64748B]">{formatDateTime(holiday.date)}</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => void removeHoliday(holiday)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <Input
                  type="date"
                  value={newHoliday.date}
                  onChange={(event) => setNewHoliday((prev) => ({ ...prev, date: event.target.value }))}
                />
                <Input
                  value={newHoliday.label}
                  onChange={(event) => setNewHoliday((prev) => ({ ...prev, label: event.target.value }))}
                  placeholder="Holiday label"
                />
                <Button onClick={() => void addHoliday()} disabled={isSavingHoliday}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Holiday
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="terms" className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[#0F172A]">Terms & Conditions</h3>
              <Badge className="bg-[#E2E8F0] text-[#334155] border-none">v{terms.version}</Badge>
            </div>

            <div className="text-xs text-[#64748B]">
              Last updated: {terms.updatedAt ? formatDateTime(terms.updatedAt) : 'N/A'}
            </div>

            {!isEditingTerms ? (
              <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-4 whitespace-pre-wrap text-sm">
                {terms.terms || 'No terms configured.'}
              </div>
            ) : (
              <Textarea
                className="min-h-[260px] font-mono"
                value={termsDraft}
                onChange={(event) => setTermsDraft(event.target.value)}
              />
            )}

            <div className="flex justify-end gap-2">
              {!isEditingTerms ? (
                <Button onClick={() => setIsEditingTerms(true)}>Edit</Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTermsDraft(terms.terms);
                      setIsEditingTerms(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => void saveTerms()} disabled={isSavingTerms}>
                    {isSavingTerms ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <DrawerForm
        open={workerDetailOpen}
        onOpenChange={setWorkerDetailOpen}
        title="Worker Detail"
        description="Profile, contractor, unit assignment, and access grants."
        widthClassName="w-full sm:max-w-[560px]"
        footer={
          workerDetail ? (
            <div className="flex w-full justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => void rejectWorker(workerDetail.accessProfileId)}
                disabled={workerDetail.accessProfileStatus !== 'PENDING'}
              >
                Reject
              </Button>
              <Button
                onClick={() => void approveWorker(workerDetail.accessProfileId)}
                disabled={workerDetail.accessProfileStatus !== 'PENDING'}
              >
                Approve
              </Button>
            </div>
          ) : null
        }
      >
        {!workerDetail ? (
          <SkeletonTable columns={1} rows={6} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[#64748B] text-xs">
                Photo
              </div>
              <div>
                <div className="font-semibold text-[#0F172A]">{workerDetail.fullName}</div>
                <div className="text-sm text-[#64748B]">{workerDetail.nationalId}</div>
                <div className="text-sm text-[#64748B]">{workerDetail.phone ?? '-'}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[#64748B]">Contractor</div>
                <div>{workerDetail.contractorName}</div>
              </div>
              <div>
                <div className="text-[#64748B]">Unit</div>
                <div>{workerDetail.unitNumber}</div>
              </div>
              <div>
                <div className="text-[#64748B]">Job Type</div>
                <div>{workerDetail.jobType ?? '-'}</div>
              </div>
              <div>
                <div className="text-[#64748B]">Access Profile</div>
                <StatusBadge value={workerDetail.accessProfileStatus} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-[#0F172A]">Access Grants Timeline</div>
              {workerDetail.accessGrants.length === 0 ? (
                <EmptyState title="No access grants" description="No grant history available for this worker." />
              ) : (
                workerDetail.accessGrants.map((grant) => (
                  <div key={grant.id} className="rounded-md border border-[#E2E8F0] p-3 text-sm">
                    <div className="font-medium text-[#0F172A]">{grant.permissions.join(', ')}</div>
                    <div className="text-[#64748B]">
                      {formatDateTime(grant.validFrom)} - {formatDateTime(grant.validTo)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DrawerForm>
    </div>
  );
}
