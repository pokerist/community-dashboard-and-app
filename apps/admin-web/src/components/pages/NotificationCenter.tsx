import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Plus, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type DataTableColumn } from '../DataTable';
import { DrawerForm } from '../DrawerForm';
import { EmptyState } from '../EmptyState';
import { PageHeader } from '../PageHeader';
import { SkeletonTable } from '../SkeletonTable';
import { StatCard } from '../StatCard';
import { StatusBadge } from '../StatusBadge';
import notificationsService, {
  type NotificationAudience,
  type NotificationChannel,
  type NotificationListItem,
  type NotificationStatus,
  type NotificationTemplate,
  type NotificationType,
  type SendNotificationPayload,
} from '../../lib/notificationsService';
import { errorMessage, formatDateTime, humanizeEnum } from '../../lib/live-data';

const channels: NotificationChannel[] = ['IN_APP', 'PUSH', 'SMS', 'EMAIL', 'WHATSAPP'];
const types: NotificationType[] = [
  'ANNOUNCEMENT',
  'PAYMENT_REMINDER',
  'MAINTENANCE_ALERT',
  'EVENT_NOTIFICATION',
  'EMERGENCY_ALERT',
  'OTP',
];
const audiences: NotificationAudience[] = [
  'ALL',
  'SPECIFIC_RESIDENCES',
  'SPECIFIC_BLOCKS',
  'SPECIFIC_UNITS',
];

type SendForm = {
  type: NotificationType;
  title: string;
  messageEn: string;
  messageAr: string;
  channels: NotificationChannel[];
  targetAudience: NotificationAudience;
  communityIdsInput: string;
  clusterIdsInput: string;
  unitIdsInput: string;
};

const defaultSendForm: SendForm = {
  type: 'ANNOUNCEMENT',
  title: '',
  messageEn: '',
  messageAr: '',
  channels: ['IN_APP', 'PUSH'],
  targetAudience: 'ALL',
  communityIdsInput: '',
  clusterIdsInput: '',
  unitIdsInput: '',
};

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function NotificationCenter() {
  const [rows, setRows] = useState<NotificationListItem[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [stats, setStats] = useState({
    totalSent: 0,
    deliveredToday: 0,
    failedToday: 0,
    activeDeviceTokens: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [form, setForm] = useState<SendForm>(defaultSendForm);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    search: string;
    type: NotificationType | 'all';
    status: NotificationStatus | 'all';
    channel: NotificationChannel | 'all';
  }>({
    search: '',
    type: 'all',
    status: 'all',
    channel: 'all',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, listRes, templateRes] = await Promise.all([
        notificationsService.getStats(),
        notificationsService.list({
          page: 1,
          type: filters.type !== 'all' ? filters.type : undefined,
          status: filters.status !== 'all' ? filters.status : undefined,
          channel: filters.channel !== 'all' ? filters.channel : undefined,
        }),
        notificationsService.listTemplates(),
      ]);
      setStats({
        totalSent: statsRes.totalSent,
        deliveredToday: statsRes.deliveredToday,
        failedToday: statsRes.failedToday,
        activeDeviceTokens: statsRes.activeDeviceTokens,
      });
      setRows(listRes.data);
      setTemplates(templateRes);
    } catch (error: unknown) {
      toast.error('Failed to load notifications', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [filters.channel, filters.status, filters.type]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.title, row.type, row.status, row.targetAudience]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [filters.search, rows]);

  const submitSend = async () => {
    if (!form.title.trim() || !form.messageEn.trim()) {
      toast.error('Title and English message are required');
      return;
    }

    const payload: SendNotificationPayload = {
      type: form.type,
      title: form.title.trim(),
      messageEn: form.messageEn.trim(),
      messageAr: form.messageAr.trim() || undefined,
      channels: form.channels,
      targetAudience: form.targetAudience,
      audienceMeta:
        form.targetAudience === 'ALL'
          ? undefined
          : form.targetAudience === 'SPECIFIC_RESIDENCES'
            ? { communityIds: splitCsv(form.communityIdsInput) }
            : form.targetAudience === 'SPECIFIC_BLOCKS'
              ? { clusterIds: splitCsv(form.clusterIdsInput) }
              : { unitIds: splitCsv(form.unitIdsInput) },
    };

    try {
      await notificationsService.send(payload);
      toast.success('Notification sent');
      setForm(defaultSendForm);
      setSendOpen(false);
      await loadData();
    } catch (error: unknown) {
      toast.error('Failed to send notification', { description: errorMessage(error) });
    }
  };

  const resendFailed = async (id: string) => {
    setResendingId(id);
    try {
      const result = await notificationsService.resendFailed(id);
      toast.success('Resend completed', {
        description: `Attempted ${result.attempted}, sent ${result.sent}, failed ${result.failed}`,
      });
      await loadData();
    } catch (error: unknown) {
      toast.error('Failed to resend notification', { description: errorMessage(error) });
    } finally {
      setResendingId(null);
    }
  };

  const columns: DataTableColumn<NotificationListItem>[] = [
    {
      key: 'title',
      header: 'Title',
      className: 'py-4 px-4 min-w-[220px]',
      render: (row) => (
        <div>
          <p className="text-sm text-gray-900">{row.title}</p>
          <p className="text-xs text-gray-400 mt-1">{humanizeEnum(row.type)}</p>
        </div>
      ),
    },
    {
      key: 'audience',
      header: 'Audience',
      className: 'py-4 px-4',
      render: (row) => <span className="text-sm text-gray-700">{humanizeEnum(row.targetAudience)}</span>,
    },
    {
      key: 'channels',
      header: 'Channels',
      className: 'py-4 px-4',
      render: (row) => (
        <span className="text-sm text-gray-700">
          {row.channels.map((channel) => humanizeEnum(channel)).join(', ')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      className: 'py-4 px-4',
      render: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: 'sentAt',
      header: 'Sent',
      className: 'py-4 px-4',
      render: (row) => (
        <span className="text-sm text-gray-700">{formatDateTime(row.sentAt ?? row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'py-4 px-4 text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="bg-white/5 hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void resendFailed(row.id)}
            disabled={resendingId === row.id}
            className="bg-white/5 hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            {resendingId === row.id ? 'Resending' : 'Resend'}
          </button>
        </div>
      ),
    },
  ];

  const templateColumns: DataTableColumn<NotificationTemplate>[] = [
    {
      key: 'name',
      header: 'Name',
      className: 'py-4 px-4',
      render: (row) => <span className="text-sm text-gray-700">{row.name}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      className: 'py-4 px-4',
      render: (row) => <span className="text-sm text-gray-700">{humanizeEnum(row.type)}</span>,
    },
    {
      key: 'channels',
      header: 'Channels',
      className: 'py-4 px-4',
      render: (row) => (
        <span className="text-sm text-gray-700">
          {row.channels.map((channel) => humanizeEnum(channel)).join(', ')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      className: 'py-4 px-4',
      render: (row) => <StatusBadge value={row.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
  ];

  return (
    <div className="-m-6 bg-white p-8 min-h-[calc(100vh-120px)] text-gray-900 space-y-6">
      <PageHeader
        title="Notifications"
        description="Manage delivery and templates."
        actions={
          <button
            type="button"
            onClick={() => setSendOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Send Notification
          </button>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Total Sent" value={String(stats.totalSent)} icon="tickets" />
        <StatCard title="Delivered Today" value={String(stats.deliveredToday)} icon="active-users" />
        <StatCard title="Failed Today" value={String(stats.failedToday)} icon="complaints-open" />
        <StatCard title="Active Tokens" value={String(stats.activeDeviceTokens)} icon="devices" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-0">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
              placeholder="Search"
              className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <select
            value={filters.type}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, type: event.target.value as NotificationType | 'all' }))
            }
            className="w-44 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none"
          >
            <option value="all">All Types</option>
            {types.map((item) => (
              <option key={item} value={item}>
                {humanizeEnum(item)}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value as NotificationStatus | 'all' }))
            }
            className="w-40 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none"
          >
            <option value="all">All Status</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PENDING">Pending</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="READ">Read</option>
          </select>
          <select
            value={filters.channel}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, channel: event.target.value as NotificationChannel | 'all' }))
            }
            className="w-40 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none"
          >
            <option value="all">All Channels</option>
            {channels.map((item) => (
              <option key={item} value={item}>
                {humanizeEnum(item)}
              </option>
            ))}
          </select>
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => void loadData()}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <SkeletonTable columns={6} rows={7} />
          ) : filteredRows.length === 0 ? (
            <EmptyState
              
              title="No notifications found"
              description="Try changing filters or send a new notification."
            />
          ) : (
            <DataTable
              columns={columns}
              rows={filteredRows}
              rowKey={(row) => row.id}
              emptyTitle="No notifications found"
            />
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm font-semibold text-gray-900 mb-4">Templates</p>
        {loading ? (
          <SkeletonTable columns={4} rows={4} />
        ) : templates.length === 0 ? (
          <EmptyState
            
            compact
            title="No templates yet"
            description="Create templates from backend endpoints."
          />
        ) : (
          <DataTable
            columns={templateColumns}
            rows={templates}
            rowKey={(row) => row.id}
            emptyTitle="No templates"
          />
        )}
      </div>

      <DrawerForm
        open={sendOpen}
        onOpenChange={setSendOpen}
        title="Send Notification"
        description="Create and dispatch a notification."
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">Type</label>
            <select
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as NotificationType }))}
              className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none"
            >
              {types.map((item) => (
                <option key={item} value={item}>
                  {humanizeEnum(item)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Title</label>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Message (EN)</label>
            <textarea
              value={form.messageEn}
              onChange={(event) => setForm((prev) => ({ ...prev, messageEn: event.target.value }))}
              rows={3}
              className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Message (AR)</label>
            <textarea
              value={form.messageAr}
              onChange={(event) => setForm((prev) => ({ ...prev, messageAr: event.target.value }))}
              rows={3}
              className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Audience</label>
            <select
              value={form.targetAudience}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, targetAudience: event.target.value as NotificationAudience }))
              }
              className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none"
            >
              {audiences.map((item) => (
                <option key={item} value={item}>
                  {humanizeEnum(item)}
                </option>
              ))}
            </select>
          </div>
          {form.targetAudience === 'SPECIFIC_RESIDENCES' ? (
            <input
              value={form.communityIdsInput}
              onChange={(event) => setForm((prev) => ({ ...prev, communityIdsInput: event.target.value }))}
              placeholder="community IDs, comma separated"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50"
            />
          ) : null}
          {form.targetAudience === 'SPECIFIC_BLOCKS' ? (
            <input
              value={form.clusterIdsInput}
              onChange={(event) => setForm((prev) => ({ ...prev, clusterIdsInput: event.target.value }))}
              placeholder="cluster IDs, comma separated"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50"
            />
          ) : null}
          {form.targetAudience === 'SPECIFIC_UNITS' ? (
            <input
              value={form.unitIdsInput}
              onChange={(event) => setForm((prev) => ({ ...prev, unitIdsInput: event.target.value }))}
              placeholder="unit IDs, comma separated"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50"
            />
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setSendOpen(false)}
            className="bg-white/5 hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submitSend()}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </DrawerForm>
    </div>
  );
}
