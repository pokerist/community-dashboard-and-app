import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import apiClient, { handleApiError } from '../../lib/api-client';
import { toast } from 'sonner';

type HelpCenterEntry = {
  id: string;
  title: string;
  phone: string;
  availability?: string | null;
  priority?: number;
  isActive?: boolean;
};

type DiscoverPlace = {
  id: string;
  name: string;
  category?: string | null;
  address?: string | null;
  mapLink?: string | null;
  phone?: string | null;
  workingHours?: string | null;
  imageFileId?: string | null;
  isActive?: boolean;
};

const defaultHelp: Omit<HelpCenterEntry, 'id'> = {
  title: '',
  phone: '',
  availability: '',
  priority: 100,
  isActive: true,
};

const defaultPlace: Omit<DiscoverPlace, 'id'> = {
  name: '',
  category: '',
  address: '',
  mapLink: '',
  phone: '',
  workingHours: '',
  imageFileId: '',
  isActive: true,
};

export function CommunityDirectory() {
  const [tab, setTab] = useState<'help' | 'discover'>('help');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [helpRows, setHelpRows] = useState<HelpCenterEntry[]>([]);
  const [discoverRows, setDiscoverRows] = useState<DiscoverPlace[]>([]);
  const [helpForm, setHelpForm] = useState(defaultHelp);
  const [discoverForm, setDiscoverForm] = useState(defaultPlace);
  const [discoverImageFile, setDiscoverImageFile] = useState<File | null>(null);

  const activeRowsCount = useMemo(
    () => (tab === 'help' ? helpRows.length : discoverRows.length),
    [discoverRows.length, helpRows.length, tab],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [helpRes, discoverRes] = await Promise.all([
        apiClient.get<HelpCenterEntry[]>('/help-center/admin'),
        apiClient.get<DiscoverPlace[]>('/discover/admin'),
      ]);
      setHelpRows(Array.isArray(helpRes.data) ? helpRes.data : []);
      setDiscoverRows(Array.isArray(discoverRes.data) ? discoverRes.data : []);
    } catch (error) {
      toast.error('Failed to load directory', {
        description: handleApiError(error),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createHelp = async () => {
    if (!helpForm.title.trim() || !helpForm.phone.trim()) {
      toast.error('Title and phone are required');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/help-center/admin', {
        ...helpForm,
        title: helpForm.title.trim(),
        phone: helpForm.phone.trim(),
        availability: helpForm.availability?.trim() || null,
      });
      toast.success('Help center entry created');
      setHelpForm(defaultHelp);
      await load();
    } catch (error) {
      toast.error('Failed to create help center entry', {
        description: handleApiError(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const createDiscover = async () => {
    if (!discoverForm.name.trim()) {
      toast.error('Place name is required');
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.append('name', discoverForm.name.trim());
      if (discoverForm.category?.trim()) form.append('category', discoverForm.category.trim());
      if (discoverForm.address?.trim()) form.append('address', discoverForm.address.trim());
      if (discoverForm.mapLink?.trim()) form.append('mapLink', discoverForm.mapLink.trim());
      if (discoverForm.phone?.trim()) form.append('phone', discoverForm.phone.trim());
      if (discoverForm.workingHours?.trim()) form.append('workingHours', discoverForm.workingHours.trim());
      if (discoverForm.imageFileId?.trim()) form.append('imageFileId', discoverForm.imageFileId.trim());
      if (discoverImageFile) {
        form.append('image', discoverImageFile);
      }
      await apiClient.post('/discover/admin', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Discover place created');
      setDiscoverForm(defaultPlace);
      setDiscoverImageFile(null);
      await load();
    } catch (error) {
      toast.error('Failed to create discover place', {
        description: handleApiError(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const removeHelp = async (id: string) => {
    try {
      await apiClient.delete(`/help-center/admin/${id}`);
      toast.success('Help center entry deleted');
      await load();
    } catch (error) {
      toast.error('Failed to delete help center entry', {
        description: handleApiError(error),
      });
    }
  };

  const removeDiscover = async (id: string) => {
    try {
      await apiClient.delete(`/discover/admin/${id}`);
      toast.success('Discover place deleted');
      await load();
    } catch (error) {
      toast.error('Failed to delete discover place', {
        description: handleApiError(error),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[#1E293B] text-2xl font-semibold">Help & Discover</h1>
            <p className="text-[#64748B] mt-1 text-sm">
              Manage resident-facing Help Center contacts and Discover places.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC]"
          >
            <RefreshCw className="w-4 h-4" />
            Reload
          </button>
        </div>

        <div className="mt-4 inline-flex rounded-xl border border-[#E2E8F0] overflow-hidden" role="tablist" aria-label="Directory tabs">
          <button
            type="button"
            onClick={() => setTab('help')}
            role="tab"
            aria-selected={tab === 'help'}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'help' ? 'bg-[#00B386] text-white shadow-sm' : 'bg-white text-[#334155] hover:bg-[#F8FAFC]'}`}
          >
            Help Center
          </button>
          <button
            type="button"
            onClick={() => setTab('discover')}
            role="tab"
            aria-selected={tab === 'discover'}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'discover' ? 'bg-[#00B386] text-white shadow-sm' : 'bg-white text-[#334155] hover:bg-[#F8FAFC]'}`}
          >
            Discover
          </button>
        </div>

        <p className="mt-3 text-xs text-[#64748B]">Items: {activeRowsCount}</p>
      </div>

      {tab === 'help' ? (
        <>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4">
            <h2 className="text-[#1E293B] text-lg font-semibold">Add Help Center Entry</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border border-[#CBD5E1] rounded-lg px-3 py-2" placeholder="Title" value={helpForm.title} onChange={(e) => setHelpForm((p) => ({ ...p, title: e.target.value }))} />
              <input className="border border-[#CBD5E1] rounded-lg px-3 py-2" placeholder="Phone" value={helpForm.phone} onChange={(e) => setHelpForm((p) => ({ ...p, phone: e.target.value }))} />
              <input className="border border-[#CBD5E1] rounded-lg px-3 py-2" placeholder="Availability" value={helpForm.availability ?? ''} onChange={(e) => setHelpForm((p) => ({ ...p, availability: e.target.value }))} />
              <input className="border border-[#CBD5E1] rounded-lg px-3 py-2" type="number" placeholder="Priority" value={helpForm.priority ?? 100} onChange={(e) => setHelpForm((p) => ({ ...p, priority: Number(e.target.value || 100) }))} />
            </div>
            <button
              type="button"
              onClick={() => void createHelp()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00B386] px-4 py-2 text-white text-sm font-medium disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'Saving...' : 'Create'}
            </button>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
            <h2 className="text-[#1E293B] text-lg font-semibold mb-4">Help Center Entries</h2>
            {loading ? (
              <p className="text-sm text-[#64748B]">Loading...</p>
            ) : helpRows.length === 0 ? (
              <p className="text-sm text-[#64748B]">No entries yet.</p>
            ) : (
              <div className="space-y-3">
                {helpRows.map((row) => (
                  <div key={row.id} className="border border-[#E2E8F0] rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">{row.title}</p>
                      <p className="text-xs text-[#64748B]">{row.phone} {row.availability ? `• ${row.availability}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => void removeHelp(row.id)} className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-1.5 text-xs text-[#B91C1C]">
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4">
            <h2 className="text-[#1E293B] text-lg font-semibold">Add Discover Place</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border border-[#CBD5E1] rounded-lg px-3 py-2" placeholder="Name" value={discoverForm.name} onChange={(e) => setDiscoverForm((p) => ({ ...p, name: e.target.value }))} />
              <input className="border border-[#CBD5E1] rounded-lg px-3 py-2" placeholder="Category" value={discoverForm.category ?? ''} onChange={(e) => setDiscoverForm((p) => ({ ...p, category: e.target.value }))} />
              <input className="border border-[#CBD5E1] rounded-lg px-3 py-2" placeholder="Address" value={discoverForm.address ?? ''} onChange={(e) => setDiscoverForm((p) => ({ ...p, address: e.target.value }))} />
              <input className="border border-[#CBD5E1] rounded-lg px-3 py-2" placeholder="Map URL" value={discoverForm.mapLink ?? ''} onChange={(e) => setDiscoverForm((p) => ({ ...p, mapLink: e.target.value }))} />
              <input className="border border-[#CBD5E1] rounded-lg px-3 py-2" placeholder="Phone" value={discoverForm.phone ?? ''} onChange={(e) => setDiscoverForm((p) => ({ ...p, phone: e.target.value }))} />
              <input className="border border-[#CBD5E1] rounded-lg px-3 py-2" placeholder="Working Hours" value={discoverForm.workingHours ?? ''} onChange={(e) => setDiscoverForm((p) => ({ ...p, workingHours: e.target.value }))} />
              <input className="border border-[#CBD5E1] rounded-lg px-3 py-2" placeholder="Image File ID (optional)" value={discoverForm.imageFileId ?? ''} onChange={(e) => setDiscoverForm((p) => ({ ...p, imageFileId: e.target.value }))} />
              <input className="border border-[#CBD5E1] rounded-lg px-3 py-2" type="file" accept="image/*" onChange={(e) => setDiscoverImageFile(e.target.files?.[0] ?? null)} />
            </div>
            <button
              type="button"
              onClick={() => void createDiscover()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00B386] px-4 py-2 text-white text-sm font-medium disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'Saving...' : 'Create'}
            </button>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
            <h2 className="text-[#1E293B] text-lg font-semibold mb-4">Discover Places</h2>
            {loading ? (
              <p className="text-sm text-[#64748B]">Loading...</p>
            ) : discoverRows.length === 0 ? (
              <p className="text-sm text-[#64748B]">No places yet.</p>
            ) : (
              <div className="space-y-3">
                {discoverRows.map((row) => (
                  <div key={row.id} className="border border-[#E2E8F0] rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">{row.name}</p>
                      <p className="text-xs text-[#64748B]">{row.category || 'General'} {row.address ? `• ${row.address}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => void removeDiscover(row.id)} className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-1.5 text-xs text-[#B91C1C]">
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
