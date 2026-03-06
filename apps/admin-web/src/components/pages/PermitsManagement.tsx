import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, Pencil, Plus, X } from 'lucide-react';
import { PermitCategory, ServiceFieldType } from '@prisma/client';
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
import { StatusBadge } from '../StatusBadge';
import permitsService, {
  type PermitRequestDetail,
  type PermitRequestListItem,
  type PermitStats,
  type PermitTypeItem,
} from '../../lib/permitsService';
import { errorMessage, formatDateTime, humanizeEnum } from '../../lib/live-data';

type PermitStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const permitCategories: PermitCategory[] = [
  PermitCategory.ACCOUNT_INFO,
  PermitCategory.LEGAL_OWNERSHIP,
  PermitCategory.UTILITIES_SERVICES,
  PermitCategory.COMMUNITY_ACTIVITIES,
  PermitCategory.OPERATIONAL,
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

function categoryBadgeClass(category: PermitCategory): string {
  if (category === PermitCategory.ACCOUNT_INFO) {
    return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
  }
  if (category === PermitCategory.LEGAL_OWNERSHIP) {
    return 'bg-violet-500/10 text-violet-400 border border-violet-500/20';
  }
  if (category === PermitCategory.UTILITIES_SERVICES) {
    return 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
  }
  if (category === PermitCategory.COMMUNITY_ACTIVITIES) {
    return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  }
  return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
}

function fileNameFromPath(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] || path;
}

function renderFieldValue(field: PermitRequestDetail['fieldValues'][number]): JSX.Element {
  if (field.type === ServiceFieldType.FILE && field.valueText) {
    return (
      <a href={field.valueText} target="_blank" rel="noreferrer" className="text-[#0B5FFF] underline">
        {fileNameFromPath(field.valueText)}
      </a>
    );
  }

  if (field.type === ServiceFieldType.BOOLEAN) {
    if (field.valueBool === null) {
      return <span className="text-slate-500">--</span>;
    }
    return <span className="text-slate-200">{field.valueBool ? 'Yes' : 'No'}</span>;
  }

  if (field.type === ServiceFieldType.DATE) {
    return (
      <span className="text-slate-200">
        {field.valueDate ? formatDateTime(field.valueDate) : '--'}
      </span>
    );
  }

  if (field.valueNumber !== null) {
    return <span className="text-slate-200">{field.valueNumber}</span>;
  }

  if (field.valueText) {
    return <span className="text-slate-200">{field.valueText}</span>;
  }

  return <span className="text-slate-500">--</span>;
}

export function PermitsManagement() {
  const [activeTab, setActiveTab] = useState<'requests' | 'types'>('requests');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PermitStats | null>(null);
  const [permitTypes, setPermitTypes] = useState<PermitTypeItem[]>([]);
  const [requests, setRequests] = useState<PermitRequestListItem[]>([]);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PermitStatusFilter>('ALL');
  const [category, setCategory] = useState<'ALL' | PermitCategory>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedType, setSelectedType] = useState<PermitTypeItem | null>(null);
  const [editingTypeName, setEditingTypeName] = useState(false);
  const [typeNameDraft, setTypeNameDraft] = useState('');
  const [inlineFieldLabel, setInlineFieldLabel] = useState('');
  const [inlineFieldType, setInlineFieldType] = useState<ServiceFieldType>(ServiceFieldType.TEXT);
  const [inlineFieldRequired, setInlineFieldRequired] = useState(false);
  const [addingField, setAddingField] = useState(false);

  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCategory, setNewTypeCategory] = useState<PermitCategory>(PermitCategory.OPERATIONAL);
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const [newFields, setNewFields] = useState([
    { id: 'new-field-1', label: '', type: ServiceFieldType.TEXT, required: false },
  ]);

  const [requestDrawerOpen, setRequestDrawerOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<PermitRequestDetail | null>(null);
  const [approveMode, setApproveMode] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const groupedTypes = useMemo(() => {
    const groups: Record<PermitCategory, PermitTypeItem[]> = {
      ACCOUNT_INFO: [],
      LEGAL_OWNERSHIP: [],
      UTILITIES_SERVICES: [],
      COMMUNITY_ACTIVITIES: [],
      OPERATIONAL: [],
    };
    permitTypes.forEach((permitType) => {
      groups[permitType.category].push(permitType);
    });
    return groups;
  }, [permitTypes]);

  const load = async () => {
    setLoading(true);
    try {
      const [statsData, typeData, requestData] = await Promise.all([
        permitsService.getStats(),
        permitsService.listPermitTypes(true),
        permitsService.listRequests({
          search: search || undefined,
          status: status === 'ALL' ? undefined : status,
          category: category === 'ALL' ? undefined : category,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      ]);

      setStats(statsData);
      setPermitTypes(typeData);
      setRequests(requestData);

      if (typeData.length > 0 && !selectedType) {
        setSelectedType(typeData[0]);
        setTypeNameDraft(typeData[0].name);
      }
    } catch (error) {
      toast.error('Failed to load permits', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [search, status, category, dateFrom, dateTo]);

  const refreshSelectedType = async (id: string) => {
    const detail = await permitsService.getPermitType(id);
    setSelectedType(detail);
    setTypeNameDraft(detail.name);
    await load();
  };

  const openRequestDrawer = async (requestId: string) => {
    try {
      const detail = await permitsService.getRequestDetail(requestId);
      setActiveRequest(detail);
      setApproveMode(false);
      setRejectMode(false);
      setRejectReason('');
      setRequestDrawerOpen(true);
    } catch (error) {
      toast.error('Failed to load request', { description: errorMessage(error) });
    }
  };

  const saveTypeFieldOrder = async (orderedFields: PermitTypeItem['fields']) => {
    if (!selectedType) return;

    try {
      await permitsService.updatePermitType(selectedType.id, {
        name: selectedType.name,
        category: selectedType.category,
        description: selectedType.description ?? undefined,
        fields: orderedFields.map((field, index) => ({
          label: field.label,
          type: field.type,
          placeholder: field.placeholder ?? undefined,
          required: field.required,
          displayOrder: index + 1,
        })),
      });
      await refreshSelectedType(selectedType.id);
    } catch (error) {
      toast.error('Failed to reorder fields', { description: errorMessage(error) });
    }
  };

  const moveSelectedField = async (fieldId: string, direction: 'up' | 'down') => {
    if (!selectedType) return;
    const currentIndex = selectedType.fields.findIndex((field) => field.id === fieldId);
    if (currentIndex < 0) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= selectedType.fields.length) return;

    const ordered = selectedType.fields.slice();
    const [moved] = ordered.splice(currentIndex, 1);
    ordered.splice(targetIndex, 0, moved);
    await saveTypeFieldOrder(ordered);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl text-[#1E293B]">Permits</h2>
        <p className="text-sm text-[#64748B]">Permit requests and permit type configuration.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Total Requests</p>
          <p className="text-lg text-slate-200">{stats?.totalRequests ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Pending</p>
          <p className="text-lg text-slate-200">{stats?.pendingRequests ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Approved This Month</p>
          <p className="text-lg text-slate-200">{stats?.approvedThisMonth ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Rejected This Month</p>
          <p className="text-lg text-slate-200">{stats?.rejectedThisMonth ?? 0}</p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'requests' | 'types')}>
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="types">Permit Types</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Input
                className="flex-1 max-w-xs"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search request #, unit, requester"
              />
              <Select value={status} onValueChange={(value) => setStatus(value as PermitStatusFilter)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={(value) => setCategory(value as 'ALL' | PermitCategory)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {permitCategories.map((categoryValue) => (
                    <SelectItem key={categoryValue} value={categoryValue}>
                      {humanizeEnum(categoryValue)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input className="w-36" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              <Input className="w-36" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Permit Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.requestNumber}</TableCell>
                    <TableCell>{request.permitTypeName}</TableCell>
                    <TableCell>
                      <Badge className={categoryBadgeClass(request.category)}>
                        {humanizeEnum(request.category)}
                      </Badge>
                    </TableCell>
                    <TableCell>{request.unitNumber}</TableCell>
                    <TableCell>{request.requesterName}</TableCell>
                    <TableCell>{formatDateTime(request.submittedAt)}</TableCell>
                    <TableCell>
                      <StatusBadge value={request.status} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => void openRequestDrawer(request.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">
                      No permit requests found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <div className="flex justify-end">
            <Button className="bg-[#0B5FFF] text-white hover:bg-[#0B5FFF]/90" onClick={() => setCreateDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Permit Type
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card className="col-span-2 space-y-4 p-4">
              {permitCategories.map((categoryValue) => (
                <div key={categoryValue} className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{humanizeEnum(categoryValue)}</p>
                  {groupedTypes[categoryValue].map((permitType) => (
                    <div
                      key={permitType.id}
                      className={`flex items-center justify-between rounded-md border p-3 ${
                        selectedType?.id === permitType.id
                          ? 'border-[#0B5FFF]/40 bg-[#0B5FFF]/5'
                          : 'border-white/10'
                      }`}
                    >
                      <button
                        className="text-left"
                        onClick={() => {
                          setSelectedType(permitType);
                          setTypeNameDraft(permitType.name);
                          setEditingTypeName(false);
                        }}
                      >
                        <p className="text-sm text-slate-200">{permitType.name}</p>
                        <p className="text-xs text-slate-500">{permitType.fields.length} fields</p>
                      </button>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={permitType.isActive}
                          onCheckedChange={async () => {
                            await permitsService.togglePermitType(permitType.id);
                            await load();
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedType(permitType);
                            setTypeNameDraft(permitType.name);
                            setEditingTypeName(true);
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {!loading && permitTypes.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No permit types configured.</p>
              ) : null}
            </Card>

            <Card className="space-y-3 p-4">
              {selectedType ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Type Name</Label>
                      {!editingTypeName ? (
                        <Button variant="ghost" size="sm" onClick={() => setEditingTypeName(true)}>
                          <Pencil className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                      ) : null}
                    </div>
                    {editingTypeName ? (
                      <div className="flex items-center gap-2">
                        <Input value={typeNameDraft} onChange={(event) => setTypeNameDraft(event.target.value)} />
                        <Button
                          size="icon"
                          onClick={async () => {
                            await permitsService.updatePermitType(selectedType.id, { name: typeNameDraft.trim() });
                            setEditingTypeName(false);
                            await refreshSelectedType(selectedType.id);
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => {
                            setTypeNameDraft(selectedType.name);
                            setEditingTypeName(false);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-200">{selectedType.name}</p>
                    )}
                    <Badge className={categoryBadgeClass(selectedType.category)}>
                      {humanizeEnum(selectedType.category)}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Fields</p>
                    {selectedType.fields.map((field, index) => (
                      <div key={field.id} className="rounded-md border border-white/10 p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-200">{field.label}</span>
                          <Badge className="bg-white/5 text-slate-300">{humanizeEnum(field.type)}</Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span>{field.required ? 'Required' : 'Optional'}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={index === 0}
                              onClick={() => void moveSelectedField(field.id, 'up')}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={index === selectedType.fields.length - 1}
                              onClick={() => void moveSelectedField(field.id, 'down')}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await permitsService.removeField(field.id);
                                await refreshSelectedType(selectedType.id);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {addingField ? (
                      <div className="space-y-2 rounded-md border border-white/10 p-2">
                        <Input
                          value={inlineFieldLabel}
                          onChange={(event) => setInlineFieldLabel(event.target.value)}
                          placeholder="Field label"
                        />
                        <Select value={inlineFieldType} onValueChange={(value) => setInlineFieldType(value as ServiceFieldType)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldTypeOptions.map((typeValue) => (
                              <SelectItem key={typeValue} value={typeValue}>
                                {humanizeEnum(typeValue)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-2 text-xs text-slate-400">
                          <input
                            type="checkbox"
                            checked={inlineFieldRequired}
                            onChange={(event) => setInlineFieldRequired(event.target.checked)}
                          />
                          Required
                        </label>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={async () => {
                              await permitsService.addField(selectedType.id, {
                                label: inlineFieldLabel.trim(),
                                type: inlineFieldType,
                                required: inlineFieldRequired,
                              });
                              setInlineFieldLabel('');
                              setInlineFieldType(ServiceFieldType.TEXT);
                              setInlineFieldRequired(false);
                              setAddingField(false);
                              await refreshSelectedType(selectedType.id);
                            }}
                          >
                            Confirm
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setAddingField(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setAddingField(true)}>
                        Add Field
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="py-8 text-sm text-slate-500">Select a permit type to edit.</p>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <DrawerForm
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
        title="Add Permit Type"
        description="Create a permit type and initial dynamic fields."
      >
        <div className="space-y-3">
          <Label>Name</Label>
          <Input value={newTypeName} onChange={(event) => setNewTypeName(event.target.value)} />

          <Label>Category</Label>
          <Select value={newTypeCategory} onValueChange={(value) => setNewTypeCategory(value as PermitCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {permitCategories.map((categoryValue) => (
                <SelectItem key={categoryValue} value={categoryValue}>
                  {humanizeEnum(categoryValue)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label>Description</Label>
          <Textarea rows={3} value={newTypeDescription} onChange={(event) => setNewTypeDescription(event.target.value)} />

          <div className="space-y-2">
            <p className="text-xs text-slate-500">Fields</p>
            {newFields.map((field) => (
              <div key={field.id} className="grid grid-cols-[1fr_130px_90px_32px] gap-2">
                <Input
                  value={field.label}
                  onChange={(event) =>
                    setNewFields((current) =>
                      current.map((item) => (item.id === field.id ? { ...item, label: event.target.value } : item)),
                    )
                  }
                  placeholder="Label"
                />
                <Select
                  value={field.type}
                  onValueChange={(value) =>
                    setNewFields((current) =>
                      current.map((item) =>
                        item.id === field.id ? { ...item, type: value as ServiceFieldType } : item,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldTypeOptions.map((typeValue) => (
                      <SelectItem key={typeValue} value={typeValue}>
                        {humanizeEnum(typeValue)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) =>
                      setNewFields((current) =>
                        current.map((item) =>
                          item.id === field.id ? { ...item, required: event.target.checked } : item,
                        ),
                      )
                    }
                  />
                  Req
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setNewFields((current) => current.filter((item) => item.id !== field.id))}
                >
                  X
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setNewFields((current) => [
                  ...current,
                  {
                    id: `new-field-${Date.now()}-${current.length}`,
                    label: '',
                    type: ServiceFieldType.TEXT,
                    required: false,
                  },
                ])
              }
            >
              Add Field
            </Button>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  await permitsService.createPermitType({
                    name: newTypeName.trim(),
                    category: newTypeCategory,
                    description: newTypeDescription.trim() || undefined,
                    fields: newFields
                      .filter((field) => field.label.trim().length > 0)
                      .map((field, index) => ({
                        label: field.label.trim(),
                        type: field.type,
                        required: field.required,
                        displayOrder: index + 1,
                      })),
                  });

                  setCreateDrawerOpen(false);
                  setNewTypeName('');
                  setNewTypeCategory(PermitCategory.OPERATIONAL);
                  setNewTypeDescription('');
                  setNewFields([{ id: 'new-field-1', label: '', type: ServiceFieldType.TEXT, required: false }]);
                  await load();
                } catch (error) {
                  toast.error('Failed to create permit type', { description: errorMessage(error) });
                }
              }}
            >
              Create
            </Button>
          </div>
        </div>
      </DrawerForm>

      <DrawerForm
        open={requestDrawerOpen}
        onOpenChange={setRequestDrawerOpen}
        title={activeRequest?.requestNumber ?? 'Permit Request'}
        description="Review permit request and decide."
        widthClassName="w-full sm:max-w-[480px]"
      >
        {activeRequest ? (
          <div className="space-y-3">
            <Card className="p-3">
              <p className="font-mono text-sm text-slate-200">{activeRequest.requestNumber}</p>
              <p className="text-sm text-slate-300">{activeRequest.permitType.name}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge className={categoryBadgeClass(activeRequest.permitType.category)}>
                  {humanizeEnum(activeRequest.permitType.category)}
                </Badge>
                <StatusBadge value={activeRequest.status} />
              </div>
              <p className="mt-2 text-xs text-slate-500">Submitted: {formatDateTime(activeRequest.submittedAt)}</p>
            </Card>

            <Card className="space-y-1 p-3 text-sm">
              <p className="text-xs text-slate-500">Submitted By</p>
              <p className="text-slate-200">{activeRequest.requester.name}</p>
              <p className="text-slate-500">{activeRequest.requester.phone ?? '--'}</p>
              <p className="text-slate-500">Unit {activeRequest.unit.unitNumber}</p>
            </Card>

            <Card className="space-y-2 p-3 text-sm">
              <p className="text-xs text-slate-500">Field Values</p>
              {activeRequest.fieldValues.map((field) => (
                <div key={field.fieldId} className="grid grid-cols-[160px_1fr] gap-2">
                  <span className="text-slate-500">{field.label}</span>
                  {renderFieldValue(field)}
                </div>
              ))}
            </Card>

            {activeRequest.notes ? (
              <Card className="p-3 text-sm">
                <p className="text-xs text-slate-500">Notes</p>
                <p className="text-slate-200">{activeRequest.notes}</p>
              </Card>
            ) : null}

            {activeRequest.status === 'PENDING' ? (
              <div className="space-y-2">
                {rejectMode ? (
                  <>
                    <Textarea
                      rows={3}
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Enter rejection reason"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        onClick={async () => {
                          try {
                            const detail = await permitsService.rejectRequest(activeRequest.id, rejectReason.trim());
                            setActiveRequest(detail);
                            setRejectMode(false);
                            await load();
                          } catch (error) {
                            toast.error('Failed to reject request', { description: errorMessage(error) });
                          }
                        }}
                      >
                        Confirm Reject
                      </Button>
                      <Button variant="outline" onClick={() => setRejectMode(false)}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : approveMode ? (
                  <div className="flex items-center gap-2">
                    <Button
                      className="bg-[#0B5FFF] text-white hover:bg-[#0B5FFF]/90"
                      onClick={async () => {
                        try {
                          const detail = await permitsService.approveRequest(activeRequest.id);
                          setActiveRequest(detail);
                          setApproveMode(false);
                          await load();
                        } catch (error) {
                          toast.error('Failed to approve request', { description: errorMessage(error) });
                        }
                      }}
                    >
                      Confirm Approve
                    </Button>
                    <Button variant="outline" onClick={() => setApproveMode(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button className="bg-[#0B5FFF] text-white hover:bg-[#0B5FFF]/90" onClick={() => setApproveMode(true)}>
                      Approve
                    </Button>
                    <Button variant="destructive" onClick={() => setRejectMode(true)}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <Card className="p-3 text-sm text-slate-300">
                <p>Status: {humanizeEnum(activeRequest.status)}</p>
                <p>Reviewed By: {activeRequest.reviewer?.name ?? '--'}</p>
                <p>Reviewed At: {activeRequest.reviewedAt ? formatDateTime(activeRequest.reviewedAt) : '--'}</p>
              </Card>
            )}
          </div>
        ) : (
          <p className="py-8 text-sm text-slate-500">No request selected.</p>
        )}
      </DrawerForm>
    </div>
  );
}
