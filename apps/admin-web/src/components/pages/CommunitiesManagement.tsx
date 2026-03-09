import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Building,
  DoorOpen,
  FileText,
  LayoutGrid,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import communityService, {
  type ClusterItem,
  type CommunityDetail,
  type CommunityListItem,
  type GateItem,
  type GateRole,
  type PhaseItem,
} from '../../lib/community-service';
import { handleApiError } from '../../lib/api-client';

const GATE_ROLE_OPTIONS: GateRole[] = ['RESIDENT', 'VISITOR', 'WORKER', 'DELIVERY', 'STAFF', 'RIDESHARE'];

type CommunityFormState = { name: string; isActive: boolean; guidelines: string };
type PhaseFormState = { name: string };
type ClusterFormState = { name: string };
type GateFormState = {
  name: string;
  etaMinutes: string;
  allowedRoles: GateRole[];
  phaseIds: string[];
  clusterIds: string[];
};

const defaultCommunityForm: CommunityFormState = { name: '', isActive: true, guidelines: '' };
const defaultPhaseForm: PhaseFormState = { name: '' };
const defaultClusterForm: ClusterFormState = { name: '' };
const defaultGateForm: GateFormState = {
  name: '',
  etaMinutes: '',
  allowedRoles: ['VISITOR'],
  phaseIds: [],
  clusterIds: [],
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '7px',
  border: '1px solid #E5E7EB',
  fontSize: '13px',
  color: '#111827',
  background: '#FFFFFF',
  outline: 'none',
  fontFamily: "'Work Sans', sans-serif",
  boxSizing: 'border-box',
};

function IconBtn({ icon, onClick, danger = false, disabled = false }: {
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type='button'
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: '1px solid #EBEBEB',
        background: '#FFFFFF',
        color: disabled ? '#D1D5DB' : danger ? '#DC2626' : '#6B7280',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </button>
  );
}

function PrimaryBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type='button'
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: '7px',
        background: '#2563EB',
        color: '#FFFFFF',
        border: 'none',
        cursor: 'pointer',
        fontSize: '12.5px',
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

export function CommunitiesManagement() {
  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CommunityDetail | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'phases' | 'clusters' | 'gates' | 'guidelines'>('phases');

  const [communityDialogOpen, setCommunityDialogOpen] = useState(false);
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [clusterDialogOpen, setClusterDialogOpen] = useState(false);
  const [gateDialogOpen, setGateDialogOpen] = useState(false);

  const [editingCommunity, setEditingCommunity] = useState<CommunityListItem | null>(null);
  const [editingPhase, setEditingPhase] = useState<PhaseItem | null>(null);
  const [editingCluster, setEditingCluster] = useState<ClusterItem | null>(null);
  const [editingGate, setEditingGate] = useState<GateItem | null>(null);

  const [communityForm, setCommunityForm] = useState<CommunityFormState>(defaultCommunityForm);
  const [phaseForm, setPhaseForm] = useState<PhaseFormState>(defaultPhaseForm);
  const [clusterForm, setClusterForm] = useState<ClusterFormState>(defaultClusterForm);
  const [gateForm, setGateForm] = useState<GateFormState>(defaultGateForm);

  const loadCommunities = useCallback(async () => {
    try {
      const rows = await communityService.listCommunities();
      setCommunities(rows);
      if (!selectedCommunityId && rows.length > 0) setSelectedCommunityId(rows[0].id);
    } catch (e) {
      toast.error('Failed to load communities', { description: handleApiError(e) });
    }
  }, [selectedCommunityId]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const detail = await communityService.getCommunityDetail(id);
      setSelectedDetail(detail);
      const phaseId = detail.phases[0]?.id ?? '';
      setSelectedPhaseId((prev) => (prev && detail.phases.some((p) => p.id === prev) ? prev : phaseId));
    } catch (e) {
      toast.error('Failed to load community detail', { description: handleApiError(e) });
      setSelectedDetail(null);
    }
  }, []);

  useEffect(() => {
    void loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    if (selectedCommunityId) void loadDetail(selectedCommunityId);
  }, [selectedCommunityId, loadDetail]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return communities;
    return communities.filter((c) => c.name.toLowerCase().includes(t));
  }, [communities, search]);

  const clustersForPhase = useMemo(() => {
    if (!selectedDetail || !selectedPhaseId) return [];
    return selectedDetail.clusters.filter((c) => c.phaseId === selectedPhaseId);
  }, [selectedDetail, selectedPhaseId]);

  const selectedCommunity = communities.find((c) => c.id === selectedCommunityId) ?? null;

  const saveCommunity = async () => {
    if (!communityForm.name.trim()) return toast.error('Community name is required');
    const payload = {
      name: communityForm.name.trim(),
      isActive: communityForm.isActive,
      guidelines: communityForm.guidelines.trim() || undefined,
    };
    try {
      if (editingCommunity) {
        await communityService.updateCommunity(editingCommunity.id, payload);
      } else {
        const created = await communityService.createCommunity(payload);
        setSelectedCommunityId(created.id);
      }
      setCommunityDialogOpen(false);
      await loadCommunities();
    } catch (e) {
      toast.error('Failed to save community', { description: handleApiError(e) });
    }
  };

  const savePhase = async () => {
    if (!selectedCommunityId || !phaseForm.name.trim()) return toast.error('Phase name is required');
    try {
      if (editingPhase) await communityService.updatePhase(editingPhase.id, { name: phaseForm.name.trim() });
      else await communityService.createPhase(selectedCommunityId, { name: phaseForm.name.trim() });
      setPhaseDialogOpen(false);
      await loadDetail(selectedCommunityId);
      await loadCommunities();
    } catch (e) {
      toast.error('Failed to save phase', { description: handleApiError(e) });
    }
  };

  const saveCluster = async () => {
    if (!selectedCommunityId || !selectedPhaseId || !clusterForm.name.trim()) return toast.error('Select phase and enter cluster name');
    try {
      if (editingCluster) await communityService.updateCluster(editingCluster.id, { name: clusterForm.name.trim() });
      else await communityService.createCluster(selectedPhaseId, { name: clusterForm.name.trim() });
      setClusterDialogOpen(false);
      await loadDetail(selectedCommunityId);
      await loadCommunities();
    } catch (e) {
      toast.error('Failed to save cluster', { description: handleApiError(e) });
    }
  };

  const reorderPhase = async (id: string, dir: 'up' | 'down') => {
    if (!selectedCommunityId || !selectedDetail) return;
    const items = [...selectedDetail.phases];
    const idx = items.findIndex((x) => x.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= items.length) return;
    [items[idx], items[swap]] = [items[swap], items[idx]];
    try {
      await communityService.reorderPhases(selectedCommunityId, items.map((x) => x.id));
      await loadDetail(selectedCommunityId);
    } catch (e) {
      toast.error('Failed to reorder phases', { description: handleApiError(e) });
    }
  };

  const reorderCluster = async (id: string, dir: 'up' | 'down') => {
    if (!selectedCommunityId || !selectedPhaseId) return;
    const items = [...clustersForPhase];
    const idx = items.findIndex((x) => x.id === id);
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= items.length) return;
    [items[idx], items[swap]] = [items[swap], items[idx]];
    try {
      await communityService.reorderClusters(selectedPhaseId, items.map((x) => x.id));
      await loadDetail(selectedCommunityId);
    } catch (e) {
      toast.error('Failed to reorder clusters', { description: handleApiError(e) });
    }
  };

  const saveGate = async () => {
    if (!selectedCommunityId || !gateForm.name.trim()) return toast.error('Gate name is required');
    if (!gateForm.allowedRoles.length) return toast.error('Select at least one role');
    const payload = {
      name: gateForm.name.trim(),
      etaMinutes: gateForm.etaMinutes ? Number(gateForm.etaMinutes) : undefined,
      allowedRoles: gateForm.allowedRoles,
      phaseIds: gateForm.phaseIds,
      clusterIds: gateForm.clusterIds,
    };
    try {
      if (editingGate) await communityService.updateGate(editingGate.id, payload);
      else await communityService.createGate(selectedCommunityId, payload);
      setGateDialogOpen(false);
      await loadDetail(selectedCommunityId);
    } catch (e) {
      toast.error('Failed to save gate', { description: handleApiError(e) });
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '16px', fontFamily: "'Work Sans', sans-serif" }}>
      <div style={{ border: '1px solid #EBEBEB', borderRadius: '10px', background: '#FFF' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ width: '12px', height: '12px', color: '#9CA3AF', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Search communities...' style={{ ...inputStyle, paddingLeft: '28px' }} />
          </div>
        </div>
        <div>
          {filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedCommunityId(c.id)}
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #F8FAFC',
                cursor: 'pointer',
                background: c.id === selectedCommunityId ? '#EFF6FF' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#111827' }}>{c.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9CA3AF' }}>
                    {(c._count?.phases ?? 0)} phases · {(c._count?.clusters ?? 0)} clusters · {(c._count?.gates ?? 0)} gates
                  </p>
                </div>
                <IconBtn icon={<Pencil style={{ width: '11px', height: '11px' }} />} onClick={() => {
                  setEditingCommunity(c);
                  setCommunityForm({ name: c.name, isActive: c.isActive, guidelines: c.guidelines ?? '' });
                  setCommunityDialogOpen(true);
                }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px', borderTop: '1px solid #F3F4F6' }}>
          <PrimaryBtn label='Add Community' onClick={() => {
            setEditingCommunity(null);
            setCommunityForm(defaultCommunityForm);
            setCommunityDialogOpen(true);
          }} />
        </div>
      </div>

      <div style={{ border: '1px solid #EBEBEB', borderRadius: '10px', background: '#FFF' }}>
        {selectedDetail ? (
          <>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{selectedDetail.name}</h2>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#6B7280' }}>Manage phases, clusters, gates and guidelines</p>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['phases', 'clusters', 'gates', 'guidelines'] as const).map((tab) => (
                    <button key={tab} type='button' onClick={() => setActiveTab(tab)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: activeTab === tab ? '#111827' : '#FFF', color: activeTab === tab ? '#FFF' : '#6B7280', fontSize: '11.5px', cursor: 'pointer' }}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px' }}>
              {activeTab === 'phases' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ marginBottom: '4px' }}><PrimaryBtn label='Add Phase' onClick={() => { setEditingPhase(null); setPhaseForm(defaultPhaseForm); setPhaseDialogOpen(true); }} /></div>
                  {selectedDetail.phases.map((p, i) => (
                    <div key={p.id} style={{ border: '1px solid #EBEBEB', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Building style={{ width: '13px', height: '13px', color: '#2563EB' }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>{p.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9CA3AF' }}>{p.unitCount} units · {p.clusterCount ?? 0} clusters</p>
                      </div>
                      <IconBtn icon={<ArrowUp style={{ width: '11px', height: '11px' }} />} onClick={() => void reorderPhase(p.id, 'up')} disabled={i === 0} />
                      <IconBtn icon={<ArrowDown style={{ width: '11px', height: '11px' }} />} onClick={() => void reorderPhase(p.id, 'down')} disabled={i === selectedDetail.phases.length - 1} />
                      <IconBtn icon={<Pencil style={{ width: '11px', height: '11px' }} />} onClick={() => { setEditingPhase(p); setPhaseForm({ name: p.name }); setPhaseDialogOpen(true); }} />
                      <IconBtn icon={<Trash2 style={{ width: '11px', height: '11px' }} />} danger onClick={() => void (async () => {
                        if (!selectedCommunityId) return;
                        try { await communityService.deletePhase(p.id); await loadDetail(selectedCommunityId); } catch (e) { toast.error('Failed to delete phase', { description: handleApiError(e) }); }
                      })()} disabled={(p.unitCount ?? 0) > 0 || (p.clusterCount ?? 0) > 0} />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'clusters' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <select value={selectedPhaseId} onChange={(e) => setSelectedPhaseId(e.target.value)} style={{ ...inputStyle, width: '240px' }}>
                    {selectedDetail.phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div><PrimaryBtn label='Add Cluster' onClick={() => { setEditingCluster(null); setClusterForm(defaultClusterForm); setClusterDialogOpen(true); }} /></div>
                  {clustersForPhase.map((c, i) => (
                    <div key={c.id} style={{ border: '1px solid #EBEBEB', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <LayoutGrid style={{ width: '13px', height: '13px', color: '#0D9488' }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>{c.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9CA3AF' }}>{c.unitCount} units</p>
                      </div>
                      <IconBtn icon={<ArrowUp style={{ width: '11px', height: '11px' }} />} onClick={() => void reorderCluster(c.id, 'up')} disabled={i === 0} />
                      <IconBtn icon={<ArrowDown style={{ width: '11px', height: '11px' }} />} onClick={() => void reorderCluster(c.id, 'down')} disabled={i === clustersForPhase.length - 1} />
                      <IconBtn icon={<Pencil style={{ width: '11px', height: '11px' }} />} onClick={() => { setEditingCluster(c); setClusterForm({ name: c.name }); setClusterDialogOpen(true); }} />
                      <IconBtn icon={<Trash2 style={{ width: '11px', height: '11px' }} />} danger onClick={() => void (async () => {
                        if (!selectedCommunityId) return;
                        try { await communityService.deleteCluster(c.id); await loadDetail(selectedCommunityId); } catch (e) { toast.error('Failed to delete cluster', { description: handleApiError(e) }); }
                      })()} disabled={(c.unitCount ?? 0) > 0} />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'gates' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div><PrimaryBtn label='Add Gate' onClick={() => { setEditingGate(null); setGateForm(defaultGateForm); setGateDialogOpen(true); }} /></div>
                  {selectedDetail.gates.map((g) => (
                    <div key={g.id} style={{ border: '1px solid #EBEBEB', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <DoorOpen style={{ width: '13px', height: '13px', color: '#D97706' }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>{g.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9CA3AF' }}>
                          Roles: {g.allowedRoles.join(', ')}
                        </p>
                      </div>
                      <IconBtn icon={<Pencil style={{ width: '11px', height: '11px' }} />} onClick={() => {
                        setEditingGate(g);
                        setGateForm({
                          name: g.name,
                          etaMinutes: g.etaMinutes ? String(g.etaMinutes) : '',
                          allowedRoles: g.allowedRoles,
                          phaseIds: g.phaseIds ?? [],
                          clusterIds: g.clusterIds ?? [],
                        });
                        setGateDialogOpen(true);
                      }} />
                      <IconBtn icon={<Trash2 style={{ width: '11px', height: '11px' }} />} danger onClick={() => void (async () => {
                        if (!selectedCommunityId) return;
                        try { await communityService.deleteGate(g.id); await loadDetail(selectedCommunityId); } catch (e) { toast.error('Failed to delete gate', { description: handleApiError(e) }); }
                      })()} />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'guidelines' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <FileText style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                  <textarea
                    value={selectedDetail.guidelines ?? ''}
                    onChange={(e) => setSelectedDetail((prev) => (prev ? { ...prev, guidelines: e.target.value } : prev))}
                    rows={8}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                  <div>
                    <PrimaryBtn label='Save Guidelines' onClick={() => void (async () => {
                      if (!selectedCommunityId || !selectedDetail) return;
                      try {
                        await communityService.updateCommunity(selectedCommunityId, { guidelines: selectedDetail.guidelines ?? '' });
                        toast.success('Guidelines updated');
                      } catch (e) {
                        toast.error('Failed to save guidelines', { description: handleApiError(e) });
                      }
                    })()} />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: '24px', color: '#9CA3AF' }}>Select a community to manage.</div>
        )}
      </div>

      <Dialog open={communityDialogOpen} onOpenChange={setCommunityDialogOpen}>
        <DialogContent style={{ maxWidth: '520px' }}>
          <DialogHeader>
            <DialogTitle>{editingCommunity ? 'Edit Community' : 'Add Community'}</DialogTitle>
            <DialogDescription>Community basic settings.</DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input value={communityForm.name} onChange={(e) => setCommunityForm((p) => ({ ...p, name: e.target.value }))} placeholder='Community name' style={inputStyle} />
            <textarea value={communityForm.guidelines} onChange={(e) => setCommunityForm((p) => ({ ...p, guidelines: e.target.value }))} rows={4} placeholder='Guidelines' style={inputStyle} />
            <label style={{ fontSize: '12px', color: '#374151' }}><input type='checkbox' checked={communityForm.isActive} onChange={(e) => setCommunityForm((p) => ({ ...p, isActive: e.target.checked }))} /> Active</label>
            <PrimaryBtn label='Save Community' onClick={() => void saveCommunity()} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={phaseDialogOpen} onOpenChange={setPhaseDialogOpen}>
        <DialogContent style={{ maxWidth: '420px' }}>
          <DialogHeader><DialogTitle>{editingPhase ? 'Edit Phase' : 'Add Phase'}</DialogTitle></DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input value={phaseForm.name} onChange={(e) => setPhaseForm({ name: e.target.value })} placeholder='Phase name' style={inputStyle} />
            <PrimaryBtn label='Save Phase' onClick={() => void savePhase()} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={clusterDialogOpen} onOpenChange={setClusterDialogOpen}>
        <DialogContent style={{ maxWidth: '420px' }}>
          <DialogHeader><DialogTitle>{editingCluster ? 'Edit Cluster' : 'Add Cluster'}</DialogTitle></DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input value={clusterForm.name} onChange={(e) => setClusterForm({ name: e.target.value })} placeholder='Cluster name' style={inputStyle} />
            <PrimaryBtn label='Save Cluster' onClick={() => void saveCluster()} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={gateDialogOpen} onOpenChange={setGateDialogOpen}>
        <DialogContent style={{ maxWidth: '520px' }}>
          <DialogHeader><DialogTitle>{editingGate ? 'Edit Gate' : 'Add Gate'}</DialogTitle></DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input value={gateForm.name} onChange={(e) => setGateForm((p) => ({ ...p, name: e.target.value }))} placeholder='Gate name' style={inputStyle} />
            <input type='number' value={gateForm.etaMinutes} onChange={(e) => setGateForm((p) => ({ ...p, etaMinutes: e.target.value }))} placeholder='ETA (minutes)' style={inputStyle} />
            <label style={{ fontSize: '12px', color: '#374151' }}>Roles</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {GATE_ROLE_OPTIONS.map((r) => {
                const checked = gateForm.allowedRoles.includes(r);
                return (
                  <button
                    key={r}
                    type='button'
                    onClick={() => setGateForm((p) => ({ ...p, allowedRoles: checked ? p.allowedRoles.filter((x) => x !== r) : [...p.allowedRoles, r] }))}
                    style={{ padding: '5px 10px', border: '1px solid #E5E7EB', borderRadius: '6px', background: checked ? '#EFF6FF' : '#FFF', color: checked ? '#2563EB' : '#6B7280', fontSize: '11.5px', cursor: 'pointer' }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
            <label style={{ fontSize: '12px', color: '#374151' }}>Phase scope</label>
            <select
              multiple
              value={gateForm.phaseIds}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                setGateForm((p) => ({ ...p, phaseIds: values }));
              }}
              style={{ ...inputStyle, height: '120px' }}
            >
              {(selectedDetail?.phases ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label style={{ fontSize: '12px', color: '#374151' }}>Cluster scope</label>
            <select
              multiple
              value={gateForm.clusterIds}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                setGateForm((p) => ({ ...p, clusterIds: values }));
              }}
              style={{ ...inputStyle, height: '120px' }}
            >
              {(selectedDetail?.clusters ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <PrimaryBtn label='Save Gate' onClick={() => void saveGate()} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
