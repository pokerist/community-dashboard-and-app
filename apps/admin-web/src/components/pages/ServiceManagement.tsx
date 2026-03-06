import { useEffect, useMemo, useState } from 'react';
import {
  CircleDollarSign,
  Eye,
  Flame,
  Laptop,
  Plus,
  Shield,
  Sparkles,
  Trophy,
  Wrench,
} from 'lucide-react';
import { EligibilityType, ServiceCategory, ServiceFieldType, ServiceRequestStatus } from '@prisma/client';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { DrawerForm } from '../DrawerForm';
import servicesService, {
  type AssigneeOption,
  type DashboardRoleOption,
  type CreateServicePayload,
  type ServiceListItem,
  type ServiceRequestDetail,
  type ServiceRequestListItem,
  type ServiceStats,
} from '../../lib/servicesService';
import { errorMessage, formatDateTime, humanizeEnum } from '../../lib/live-data';

type ServiceManagementProps = {
  mode?: 'services' | 'requests';
};

type RequestStatus = 'ALL' | 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
type RequestPriority = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

type EditableField = {
  id: string;
  label: string;
  type: ServiceFieldType;
  required: boolean;
};

const categoryOptions: ServiceCategory[] = [
  ServiceCategory.MAINTENANCE,
  ServiceCategory.RECREATION,
  ServiceCategory.FITNESS,
  ServiceCategory.SECURITY,
  ServiceCategory.ADMIN,
  ServiceCategory.REQUESTS,
  ServiceCategory.FACILITIES,
  ServiceCategory.OTHER,
];

const requestStatusOptions: RequestStatus[] = [
  'ALL',
  'NEW',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];

const requestPriorityOptions: RequestPriority[] = [
  'ALL',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

const fieldTypeOptions: ServiceFieldType[] = [
  ServiceFieldType.TEXT,
  ServiceFieldType.TEXTAREA,
  ServiceFieldType.NUMBER,
  ServiceFieldType.DATE,
  ServiceFieldType.BOOLEAN,
  ServiceFieldType.MEMBER_SELECTOR,
  ServiceFieldType.FILE,
];

function formatCurrency(value: number): string {
  return `EGP ${value.toLocaleString()}`;
}

function priorityDot(priority: string): string {
  if (priority === 'CRITICAL') return 'bg-red-500';
  if (priority === 'HIGH') return 'bg-orange-500';
  if (priority === 'MEDIUM') return 'bg-amber-500';
  return 'bg-slate-500';
}

function serviceIcon(iconName: string | null, category: ServiceCategory) {
  const iconKey = (iconName ?? '').toLowerCase();
  if (iconKey.includes('shield') || iconKey.includes('security')) {
    return <Shield className="h-4 w-4" />;
  }
  if (iconKey.includes('trophy') || iconKey.includes('club')) {
    return <Trophy className="h-4 w-4" />;
  }
  if (iconKey.includes('sparkle') || iconKey.includes('amenity')) {
    return <Sparkles className="h-4 w-4" />;
  }
  if (iconKey.includes('laptop') || iconKey.includes('it')) {
    return <Laptop className="h-4 w-4" />;
  }
  if (iconKey.includes('flame') || iconKey.includes('gas')) {
    return <Flame className="h-4 w-4" />;
  }
  if (iconKey.includes('money') || iconKey.includes('invoice') || iconKey.includes('billing')) {
    return <CircleDollarSign className="h-4 w-4" />;
  }

  if (category === ServiceCategory.SECURITY) return <Shield className="h-4 w-4" />;
  if (category === ServiceCategory.MAINTENANCE || category === ServiceCategory.FACILITIES) {
    return <Wrench className="h-4 w-4" />;
  }
  return <Plus className="h-4 w-4" />;
}

function getSlaStatusLabel(
  status: ServiceRequestListItem['slaStatus'],
  hoursRemaining: number | null,
): string {
  if (status === 'ON_TRACK') {
    return `On Track (${hoursRemaining ?? 0}h)`;
  }
  if (status === 'BREACHED') {
    return `Breached (${Math.abs(hoursRemaining ?? 0)}h overdue)`;
  }
  if (status === 'RESOLVED') {
    return 'Resolved';
  }
  return '--';
}

function nextStatuses(current: ServiceRequestStatus): ServiceRequestStatus[] {
  if (current === ServiceRequestStatus.NEW) {
    return [ServiceRequestStatus.IN_PROGRESS, ServiceRequestStatus.CANCELLED];
  }
  if (current === ServiceRequestStatus.IN_PROGRESS) {
    return [ServiceRequestStatus.RESOLVED, ServiceRequestStatus.CANCELLED];
  }
  if (current === ServiceRequestStatus.RESOLVED) {
    return [ServiceRequestStatus.CLOSED, ServiceRequestStatus.CANCELLED];
  }
  return [];
}

function slaProgressPercent(request: ServiceRequestDetail): number | null {
  const deadline = request.sla.deadline;
  if (!deadline) return null;

  const startedAt = new Date(request.createdAt).getTime();
  const deadlineMs = new Date(deadline).getTime();
  const now = Date.now();
  const total = deadlineMs - startedAt;
  if (total <= 0) return 100;
  const elapsed = now - startedAt;
  const ratio = Math.max(0, Math.min(1, elapsed / total));
  return Math.round(ratio * 100);
}

function renderRequestFieldValue(field: ServiceRequestDetail['fieldValues'][number]): string {
  if (field.type === ServiceFieldType.BOOLEAN) {
    if (field.valueBool === null) return '--';
    return field.valueBool ? 'Yes' : 'No';
  }
  if (field.type === ServiceFieldType.DATE) {
    return field.valueDate ? formatDateTime(field.valueDate) : '--';
  }
  if (field.type === ServiceFieldType.FILE) {
    return field.fileAttachmentId ?? field.valueText ?? '--';
  }
  if (field.valueNumber !== null) {
    return String(field.valueNumber);
  }
  if (field.valueText) {
    return field.valueText;
  }
  return '--';
}

export function ServiceManagement({ mode = 'services' }: ServiceManagementProps) {
  const [activeTab, setActiveTab] = useState<'catalog' | 'requests'>(
    mode === 'requests' ? 'requests' : 'catalog',
  );
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [services, setServices] = useState<ServiceListItem[]>([]);
  const [requests, setRequests] = useState<ServiceRequestListItem[]>([]);

  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<'ALL' | ServiceCategory>('ALL');
  const [catalogStatus, setCatalogStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [requestSearch, setRequestSearch] = useState('');
  const [requestServiceId, setRequestServiceId] = useState('ALL');
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('ALL');
  const [requestPriority, setRequestPriority] = useState<RequestPriority>('ALL');
  const [slaBreachedOnly, setSlaBreachedOnly] = useState(false);

  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>(ServiceCategory.MAINTENANCE);
  const [serviceDescription, setServiceDescription] = useState('');
  const [serviceSlaHours, setServiceSlaHours] = useState('');
  const [serviceStartingPrice, setServiceStartingPrice] = useState('');
  const [serviceAssignedRoleId, setServiceAssignedRoleId] = useState('UNASSIGNED');
  const [serviceUnitEligibility, setServiceUnitEligibility] = useState<EligibilityType>(EligibilityType.ALL);
  const [serviceUrgent, setServiceUrgent] = useState(false);
  const [roleOptions, setRoleOptions] = useState<DashboardRoleOption[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [serviceFields, setServiceFields] = useState<EditableField[]>([
    { id: 'field-1', label: '', type: ServiceFieldType.TEXT, required: false },
  ]);

  const [requestDrawerOpen, setRequestDrawerOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<ServiceRequestDetail | null>(null);
  const [assignToId, setAssignToId] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [statsData, servicesData, requestsData] = await Promise.all([
        servicesService.getServiceStats(),
        servicesService.listServices({
          status: catalogStatus,
          category: catalogCategory === 'ALL' ? undefined : catalogCategory,
          search: catalogSearch || undefined,
        }),
        servicesService.listRequests({
          serviceId: requestServiceId === 'ALL' ? undefined : requestServiceId,
          status: requestStatus === 'ALL' ? undefined : requestStatus,
          priority: requestPriority === 'ALL' ? undefined : requestPriority,
          search: requestSearch || undefined,
          slaBreached: slaBreachedOnly || undefined,
        }),
      ]);
      setStats(statsData);
      setServices(servicesData);
      setRequests(requestsData);

      try {
        const roles = await servicesService.listAssignableRoles();
        setRoleOptions(roles);
      } catch {
        setRoleOptions([]);
      }

      try {
        const assignees = await servicesService.listAssignees();
        setAssigneeOptions(assignees);
      } catch {
        setAssigneeOptions([]);
      }
    } catch (error) {
      toast.error('Failed to load services', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [
    catalogSearch,
    catalogCategory,
    catalogStatus,
    requestSearch,
    requestServiceId,
    requestStatus,
    requestPriority,
    slaBreachedOnly,
  ]);

  const openCreate = () => {
    setEditingServiceId(null);
    setServiceName('');
    setServiceCategory(ServiceCategory.MAINTENANCE);
    setServiceDescription('');
    setServiceSlaHours('');
    setServiceStartingPrice('');
    setServiceAssignedRoleId('UNASSIGNED');
    setServiceUnitEligibility(EligibilityType.ALL);
    setServiceUrgent(false);
    setServiceFields([{ id: `field-${Date.now()}`, label: '', type: ServiceFieldType.TEXT, required: false }]);
    setServiceDrawerOpen(true);
  };

  const openEdit = async (serviceId: string) => {
    try {
      const detail = await servicesService.getServiceDetail(serviceId);
      setEditingServiceId(detail.id);
      setServiceName(detail.name);
      setServiceCategory(detail.category);
      setServiceDescription(detail.description ?? '');
      setServiceSlaHours(detail.slaHours ? String(detail.slaHours) : '');
      setServiceStartingPrice(detail.startingPrice ? String(detail.startingPrice) : '');
      setServiceAssignedRoleId(detail.assignedRoleId ?? 'UNASSIGNED');
      setServiceUnitEligibility(detail.unitEligibility as EligibilityType);
      setServiceUrgent(detail.isUrgent);
      setServiceFields(
        detail.fields.length > 0
          ? detail.fields.map((field) => ({
              id: field.id,
              label: field.label,
              type: field.type,
              required: field.required,
            }))
          : [{ id: `field-${Date.now()}`, label: '', type: ServiceFieldType.TEXT, required: false }],
      );
      setServiceDrawerOpen(true);
    } catch (error) {
      toast.error('Failed to load service detail', { description: errorMessage(error) });
    }
  };

  const saveService = async () => {
    const payload: CreateServicePayload = {
      name: serviceName.trim(),
      category: serviceCategory,
      description: serviceDescription.trim() || undefined,
      slaHours: serviceSlaHours ? Number(serviceSlaHours) : undefined,
      startingPrice: serviceStartingPrice ? Number(serviceStartingPrice) : undefined,
      assignedRoleId: serviceAssignedRoleId === 'UNASSIGNED' ? undefined : serviceAssignedRoleId,
      unitEligibility: serviceUnitEligibility,
      isUrgent: serviceUrgent,
      fields: serviceFields
        .filter((field) => field.label.trim().length > 0)
        .map((field, index) => ({
          label: field.label.trim(),
          type: field.type,
          required: field.required,
          order: index + 1,
        })),
    };

    if (!payload.name) {
      toast.error('Service name is required');
      return;
    }

    try {
      if (editingServiceId) {
        await servicesService.updateService(editingServiceId, payload);
      } else {
        await servicesService.createService(payload);
      }
      setServiceDrawerOpen(false);
      await load();
    } catch (error) {
      toast.error('Failed to save service', { description: errorMessage(error) });
    }
  };

  const openRequest = async (requestId: string) => {
    try {
      const detail = await servicesService.getRequestDetail(requestId);
      setActiveRequest(detail);
      setAssignToId(detail.assignee?.id ?? '');
      setStatusNote('');
      setCommentBody('');
      setInvoiceAmount('');
      setInvoiceDueDate('');
      setRequestDrawerOpen(true);
    } catch (error) {
      toast.error('Failed to load request detail', { description: errorMessage(error) });
    }
  };

  const requestAvgResolution = useMemo(() => {
    const resolvedRows = requests.filter((request) => request.slaStatus === 'RESOLVED');
    if (resolvedRows.length === 0) return 0;
    return Math.round(
      resolvedRows.reduce((sum, request) => sum + Math.abs(request.hoursRemaining ?? 0), 0) /
        resolvedRows.length,
    );
  }, [requests]);

  const refreshActiveRequest = async (requestId: string) => {
    const detail = await servicesService.getRequestDetail(requestId);
    setActiveRequest(detail);
    return detail;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl text-[#1E293B]">Services</h2>
          <p className="text-sm text-[#64748B]">Catalog and requests operations.</p>
        </div>
        {activeTab === 'catalog' ? (
          <Button className="bg-[#0B5FFF] text-white hover:bg-[#0B5FFF]/90" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Service
          </Button>
        ) : null}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'catalog' | 'requests')}>
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="catalog">Service Catalog</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4"><p className="text-xs text-slate-500">Total Services</p><p className="text-lg text-slate-200">{stats?.totalServices ?? 0}</p></Card>
            <Card className="p-4"><p className="text-xs text-slate-500">Active Services</p><p className="text-lg text-slate-200">{stats?.activeServices ?? 0}</p></Card>
            <Card className="p-4"><p className="text-xs text-slate-500">Open Requests</p><p className="text-lg text-slate-200">{stats?.openRequests ?? 0}</p></Card>
            <Card className="p-4"><p className="text-xs text-slate-500">Total Revenue</p><p className="text-lg text-slate-200">{formatCurrency(stats?.totalRevenue ?? 0)}</p></Card>
          </div>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Input className="flex-1 max-w-xs" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Search" />
              <Select value={catalogCategory} onValueChange={(value) => setCatalogCategory(value as 'ALL' | ServiceCategory)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {categoryOptions.map((category) => <SelectItem key={category} value={category}>{humanizeEnum(category)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="inline-flex overflow-hidden rounded-md border border-[#E2E8F0]">
                {(['all', 'active', 'inactive'] as const).map((statusValue) => (
                  <button key={statusValue} type="button" className={`px-3 py-2 text-sm ${catalogStatus === statusValue ? 'bg-[#0B5FFF] text-white' : 'bg-white text-slate-600'}`} onClick={() => setCatalogStatus(statusValue)}>
                    {humanizeEnum(statusValue)}
                  </button>
                ))}
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-3 gap-4">
            {services.map((serviceRow) => (
              <Card key={serviceRow.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/5 text-slate-200">{serviceIcon(serviceRow.iconName, serviceRow.category)}</div>
                  <Badge className={serviceRow.status ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}>{serviceRow.status ? 'Active' : 'Inactive'}</Badge>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-200">{serviceRow.name}</p>
                <p className="text-xs text-slate-500">{humanizeEnum(serviceRow.category)} | SLA: {serviceRow.slaHours ? `${serviceRow.slaHours}h` : 'No SLA'}</p>
                <div className="my-3 border-t border-white/10" />
                <div className="flex items-center justify-between text-sm text-slate-300"><span>{serviceRow.totalRequestsCount} requests</span><span>{formatCurrency(serviceRow.revenueTotal)}</span></div>
                <p className="mt-2 text-xs text-slate-600">Assigned to: {serviceRow.assignedRoleName ?? 'Unassigned'}</p>
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => void openEdit(serviceRow.id)}>Edit</Button>
                  <Switch checked={serviceRow.status} onCheckedChange={() => void servicesService.toggleService(serviceRow.id).then(load)} />
                </div>
              </Card>
            ))}
            {!loading && services.length === 0 ? <Card className="col-span-3 p-6 text-center text-sm text-slate-500">No services found.</Card> : null}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4"><p className="text-xs text-slate-500">Open</p><p className="text-lg text-slate-200">{stats?.openRequests ?? 0}</p></Card>
            <Card className="p-4"><p className="text-xs text-slate-500">SLA Breached</p><p className="text-lg text-red-400">{stats?.slaBreachedRequests ?? 0}</p></Card>
            <Card className="p-4"><p className="text-xs text-slate-500">Resolved This Month</p><p className="text-lg text-slate-200">{stats?.resolvedThisMonth ?? 0}</p></Card>
            <Card className="p-4"><p className="text-xs text-slate-500">Avg Resolution Time</p><p className="text-lg text-slate-200">{requestAvgResolution}h</p></Card>
          </div>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Input className="flex-1 max-w-xs" value={requestSearch} onChange={(event) => setRequestSearch(event.target.value)} placeholder="Search" />
              <Select value={requestServiceId} onValueChange={setRequestServiceId}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Services</SelectItem>
                  {services.map((serviceRow) => <SelectItem key={serviceRow.id} value={serviceRow.id}>{serviceRow.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={requestStatus} onValueChange={(value) => setRequestStatus(value as RequestStatus)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{requestStatusOptions.map((option) => <SelectItem key={option} value={option}>{humanizeEnum(option)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={requestPriority} onValueChange={(value) => setRequestPriority(value as RequestPriority)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{requestPriorityOptions.map((option) => <SelectItem key={option} value={option}>{humanizeEnum(option)}</SelectItem>)}</SelectContent>
              </Select>
              <button type="button" className={`text-xs px-3 py-1.5 rounded-full ${slaBreachedOnly ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-white/5 text-slate-400'}`} onClick={() => setSlaBreachedOnly((prev) => !prev)}>SLA Breached</button>
            </div>
          </Card>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Service</TableHead><TableHead>Unit</TableHead><TableHead>Requester</TableHead><TableHead>Assigned To</TableHead><TableHead>Priority</TableHead><TableHead>SLA Status</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id} className={request.slaStatus === 'BREACHED' ? 'border-l-2 border-red-500/30' : ''}>
                    <TableCell>{request.requestNumber}</TableCell>
                    <TableCell>{request.serviceName}</TableCell>
                    <TableCell>{request.unitNumber}</TableCell>
                    <TableCell>{request.requesterName}</TableCell>
                    <TableCell>{request.assigneeName ?? 'Unassigned'}</TableCell>
                    <TableCell><span className="inline-flex items-center gap-2 text-sm text-slate-300"><span className={`h-2 w-2 rounded-full ${priorityDot(request.priority)}`} />{humanizeEnum(request.priority)}</span></TableCell>
                    <TableCell className={request.slaStatus === 'BREACHED' ? 'text-red-400' : request.slaStatus === 'ON_TRACK' ? 'text-emerald-400' : request.slaStatus === 'RESOLVED' ? 'text-slate-500' : 'text-slate-600'}>
                      {getSlaStatusLabel(request.slaStatus, request.hoursRemaining)}
                    </TableCell>
                    <TableCell><Badge className="bg-white/5 text-slate-200">{humanizeEnum(request.status)}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => void openRequest(request.id)}><Eye className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {!loading && requests.length === 0 ? <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-slate-500">No requests found.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <DrawerForm
        open={serviceDrawerOpen}
        onOpenChange={setServiceDrawerOpen}
        title={editingServiceId ? 'Edit Service' : 'Add Service'}
        description="Configure service details and dynamic fields."
        widthClassName="w-full sm:max-w-[560px]"
        footer={<div className="flex w-full justify-end gap-2"><Button variant="outline" onClick={() => setServiceDrawerOpen(false)}>Cancel</Button><Button onClick={() => void saveService()} className="bg-[#0B5FFF] text-white">Save</Button></div>}
      >
        <div className="space-y-4">
          <Label>Name</Label>
          <Input value={serviceName} onChange={(event) => setServiceName(event.target.value)} />
          <Label>Category</Label>
          <Select value={serviceCategory} onValueChange={(value) => setServiceCategory(value as ServiceCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{categoryOptions.map((category) => <SelectItem key={category} value={category}>{humanizeEnum(category)}</SelectItem>)}</SelectContent>
          </Select>
          <Label>Description</Label>
          <Textarea rows={3} value={serviceDescription} onChange={(event) => setServiceDescription(event.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div><Label>SLA Hours</Label><Input type="number" value={serviceSlaHours} onChange={(event) => setServiceSlaHours(event.target.value)} /></div>
            <div><Label>Starting Price</Label><Input type="number" value={serviceStartingPrice} onChange={(event) => setServiceStartingPrice(event.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Assigned Role</Label>
              <Select value={serviceAssignedRoleId} onValueChange={setServiceAssignedRoleId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                  {roleOptions.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit Eligibility</Label>
              <Select value={serviceUnitEligibility} onValueChange={(value) => setServiceUnitEligibility(value as EligibilityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={EligibilityType.ALL}>All</SelectItem>
                  <SelectItem value={EligibilityType.DELIVERED_ONLY}>Delivered Only</SelectItem>
                  <SelectItem value={EligibilityType.NON_DELIVERED_ONLY}>Non Delivered Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-white/10 p-3"><span className="text-sm text-slate-300">Urgent Service</span><Switch checked={serviceUrgent} onCheckedChange={setServiceUrgent} /></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><p className="text-sm text-slate-200">Form Fields</p><Button variant="outline" size="sm" onClick={() => setServiceFields((prev) => [...prev, { id: `field-${Date.now()}-${prev.length}`, label: '', type: ServiceFieldType.TEXT, required: false }])}>Add Field</Button></div>
            {serviceFields.map((field) => (
              <div key={field.id} className="grid grid-cols-[1fr_150px_90px_36px] gap-2">
                <Input value={field.label} onChange={(event) => setServiceFields((prev) => prev.map((row) => row.id === field.id ? { ...row, label: event.target.value } : row))} placeholder="Label" />
                <Select value={field.type} onValueChange={(value) => setServiceFields((prev) => prev.map((row) => row.id === field.id ? { ...row, type: value as ServiceFieldType } : row))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fieldTypeOptions.map((type) => <SelectItem key={type} value={type}>{humanizeEnum(type)}</SelectItem>)}</SelectContent></Select>
                <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={field.required} onChange={(event) => setServiceFields((prev) => prev.map((row) => row.id === field.id ? { ...row, required: event.target.checked } : row))} />Req</label>
                <Button variant="ghost" size="icon" onClick={() => setServiceFields((prev) => prev.filter((row) => row.id !== field.id))}>X</Button>
              </div>
            ))}
          </div>
        </div>
      </DrawerForm>

      <DrawerForm open={requestDrawerOpen} onOpenChange={setRequestDrawerOpen} title={activeRequest?.service.name ?? 'Request'} description="Review and process request details." widthClassName="w-full sm:max-w-[560px]">
        {activeRequest ? (
          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="details">Details</TabsTrigger><TabsTrigger value="comments">Comments</TabsTrigger><TabsTrigger value="invoices">Invoices</TabsTrigger></TabsList>
            <TabsContent value="details" className="space-y-3">
              <Card className="p-3 text-sm text-slate-300">
                <p>Unit: {activeRequest.unit.unitNumber}</p>
                <p>Requester: {activeRequest.requester.name}</p>
                <p>Phone: {activeRequest.requester.phone ?? '--'}</p>
                <p>Submitted: {formatDateTime(activeRequest.createdAt)}</p>
              </Card>
              <Card className="p-3 text-sm text-slate-300">
                <p className="text-xs text-slate-500">SLA</p>
                <p>{activeRequest.sla.deadline ? `Deadline: ${formatDateTime(activeRequest.sla.deadline)}` : 'No SLA defined'}</p>
                {activeRequest.sla.deadline ? (
                  <>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div
                        className={`h-2 rounded-full ${activeRequest.sla.status === 'BREACHED' ? 'bg-red-400' : 'bg-emerald-400'}`}
                        style={{ width: `${slaProgressPercent(activeRequest) ?? 0}%` }}
                      />
                    </div>
                    <p className={`mt-2 text-xs ${activeRequest.sla.status === 'BREACHED' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {activeRequest.sla.status === 'BREACHED'
                        ? `${activeRequest.sla.hoursOverdue ?? 0}h overdue`
                        : `${activeRequest.sla.hoursRemaining ?? 0}h remaining`}
                    </p>
                  </>
                ) : null}
              </Card>
              <Card className="p-3 text-sm text-slate-300">
                <p className="text-xs text-slate-500">Field Values</p>
                <div className="mt-2 space-y-2">
                  {activeRequest.fieldValues.map((field) => (
                    <div key={field.fieldId} className="grid grid-cols-[160px_1fr] gap-2">
                      <span className="text-slate-500">{field.label}</span>
                      <span className="text-slate-200">{renderRequestFieldValue(field)}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-3 text-sm text-slate-300">
                <p className="text-xs text-slate-500">Assignment</p>
                <div className="mt-2 flex items-center gap-2">
                  <Select value={assignToId || 'UNASSIGNED'} onValueChange={(value) => setAssignToId(value === 'UNASSIGNED' ? '' : value)}>
                    <SelectTrigger><SelectValue placeholder="Assign to" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                      {assigneeOptions.map((assignee) => <SelectItem key={assignee.id} value={assignee.id}>{assignee.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={async () => {
                      if (!assignToId) return;
                      const detail = await servicesService.assignRequest(activeRequest.id, { assignedToId: assignToId });
                      setActiveRequest(detail);
                      await load();
                    }}
                  >
                    Assign
                  </Button>
                </div>
              </Card>
              <Card className="p-3 text-sm text-slate-300">
                <p className="text-xs text-slate-500">Status</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nextStatuses(activeRequest.status).map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const detail = await servicesService.updateRequestStatus(activeRequest.id, { status: nextStatus, notes: statusNote || undefined });
                        setActiveRequest(detail);
                        setStatusNote('');
                        await load();
                      }}
                    >
                      {humanizeEnum(nextStatus)}
                    </Button>
                  ))}
                </div>
                <Textarea className="mt-2" rows={3} value={statusNote} onChange={(event) => setStatusNote(event.target.value)} placeholder="Internal notes" />
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!statusNote.trim()) return;
                      const detail = await servicesService.addInternalNote(activeRequest.id, statusNote.trim());
                      setActiveRequest(detail);
                      setStatusNote('');
                    }}
                  >
                    Save Note
                  </Button>
                </div>
              </Card>
            </TabsContent>
            <TabsContent value="comments" className="space-y-3">
              {activeRequest.comments.map((comment) => <Card key={comment.id} className={`p-3 ${comment.isInternal ? 'border-l-4 border-amber-500' : ''}`}><div className="flex items-center justify-between"><p className="text-sm text-slate-200">{comment.authorName}</p><span className="text-xs text-slate-500">{formatDateTime(comment.createdAt)}</span></div>{comment.isInternal ? <Badge className="mt-1 bg-amber-500/10 text-amber-400">Internal</Badge> : null}<p className="mt-2 text-sm text-slate-300">{comment.body}</p></Card>)}
              {activeRequest.comments.length === 0 ? <Card className="p-4 text-sm text-slate-500">No comments yet.</Card> : null}
              <Textarea rows={3} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Comment" />
              <div className="flex items-center gap-2"><Button onClick={() => void servicesService.postComment(activeRequest.id, { body: commentBody, isInternal: false }).then(async () => { await refreshActiveRequest(activeRequest.id); setCommentBody(''); })}>Post Comment</Button><Button variant="outline" onClick={() => void servicesService.postComment(activeRequest.id, { body: commentBody, isInternal: true }).then(async () => { await refreshActiveRequest(activeRequest.id); setCommentBody(''); })}>Internal Note</Button></div>
            </TabsContent>
            <TabsContent value="invoices" className="space-y-3">
              <Table><TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead></TableRow></TableHeader><TableBody>{activeRequest.invoices.map((invoice) => <TableRow key={invoice.id}><TableCell>{invoice.invoiceNumber}</TableCell><TableCell>{formatCurrency(invoice.amount)}</TableCell><TableCell>{invoice.status}</TableCell><TableCell>{formatDateTime(invoice.dueDate)}</TableCell></TableRow>)}{activeRequest.invoices.length === 0 ? <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-slate-500">No invoices.</TableCell></TableRow> : null}</TableBody></Table>
              <Card className="p-3">
                <p className="text-xs text-slate-500">Create Invoice</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input type="number" min="1" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} placeholder="Amount" />
                  <Input type="date" value={invoiceDueDate} onChange={(event) => setInvoiceDueDate(event.target.value)} />
                </div>
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={async () => {
                    if (!invoiceAmount || Number(invoiceAmount) <= 0 || !invoiceDueDate) {
                      toast.error('Amount and due date are required');
                      return;
                    }
                    await servicesService.createRequestInvoice(activeRequest.id, {
                      amount: Number(invoiceAmount),
                      dueDate: new Date(invoiceDueDate).toISOString(),
                    });
                    const detail = await refreshActiveRequest(activeRequest.id);
                    setInvoiceAmount('');
                    setInvoiceDueDate('');
                    toast.success(`Invoice created for ${detail.requestNumber}`);
                  }}
                >
                  Create Invoice
                </Button>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="py-8 text-sm text-slate-500">No request selected.</div>
        )}
      </DrawerForm>
    </div>
  );
}

