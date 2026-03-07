
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DataTable, type DataTableColumn } from '../DataTable';
import { useEffect, useMemo, useState } from 'react';
import { SkeletonTable } from '../SkeletonTable';
import { OrderStatus } from '@prisma/client';
import { StatusBadge } from '../StatusBadge';
import { DrawerForm } from '../DrawerForm';
import { EmptyState } from '../EmptyState';
import { PageHeader } from '../PageHeader';
import { StatCard } from '../StatCard';
import { toast } from 'sonner';
import {
  ChevronRight,
  ChefHat,
  Search,
  Check,
  Truck,
  Plus,
  Eye,
} from 'lucide-react';
import orderingService, {
  type OrderDetail,
  type OrderListItem,
  type OrderStats,
  type RestaurantDetail,
  type RestaurantListItem,
} from '../../lib/orderingService';

type Tab = 'orders' | 'restaurants';
type RestaurantStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

type RestaurantForm = {
  name: string;
  description: string;
  category: string;
};

type MenuItemForm = {
  id?: string;
  name: string;
  description: string;
  price: string;
  category: string;
};

const EMPTY_RESTAURANT_FORM: RestaurantForm = {
  name: '',
  description: '',
  category: '',
};

const EMPTY_MENU_ITEM_FORM: MenuItemForm = {
  name: '',
  description: '',
  price: '',
  category: '',
};

const PIPELINE_STAGES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.DELIVERED,
];

const formatDateTime = (value: string): string => new Date(value).toLocaleString();
const formatMoney = (value: number): string => `EGP ${value.toLocaleString()}`;
const formatRelative = (value: string): string => {
  const ms = Date.now() - new Date(value).getTime();
  const mins = Math.max(1, Math.floor(ms / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const getNextStatus = (status: OrderStatus): OrderStatus | null => {
  if (status === OrderStatus.PENDING) return OrderStatus.CONFIRMED;
  if (status === OrderStatus.CONFIRMED) return OrderStatus.PREPARING;
  if (status === OrderStatus.PREPARING) return OrderStatus.DELIVERED;
  return null;
};

const quickActionLabel = (status: OrderStatus): string | null => {
  if (status === OrderStatus.PENDING) return 'Confirm';
  if (status === OrderStatus.CONFIRMED) return 'Start Preparing';
  if (status === OrderStatus.PREPARING) return 'Mark Delivered';
  return null;
};

function NextActionIcon({ status }: { status: OrderStatus }) {
  if (status === OrderStatus.PENDING) return <Check className="h-4 w-4" />;
  if (status === OrderStatus.CONFIRMED) return <ChefHat className="h-4 w-4" />;
  return <Truck className="h-4 w-4" />;
}

export function OrderingManagement() {
  const [tab, setTab] = useState<Tab>('orders');

  const [stats, setStats] = useState<OrderStats | null>(null);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState<boolean>(true);
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [orderRestaurantId, setOrderRestaurantId] = useState<string>('ALL');
  const [orderStatus, setOrderStatus] = useState<string>('ALL');
  const [orderDateFrom, setOrderDateFrom] = useState<string>('');
  const [orderDateTo, setOrderDateTo] = useState<string>('');

  const [orderDetailOpen, setOrderDetailOpen] = useState<boolean>(false);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelExpanded, setCancelExpanded] = useState<boolean>(false);

  const [restaurants, setRestaurants] = useState<RestaurantListItem[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState<boolean>(true);
  const [restaurantSearch, setRestaurantSearch] = useState<string>('');
  const [restaurantCategory, setRestaurantCategory] = useState<string>('ALL');
  const [restaurantStatus, setRestaurantStatus] =
    useState<RestaurantStatusFilter>('ALL');

  const [restaurantDrawerOpen, setRestaurantDrawerOpen] = useState<boolean>(false);
  const [editingRestaurantId, setEditingRestaurantId] = useState<string | null>(
    null,
  );
  const [restaurantForm, setRestaurantForm] =
    useState<RestaurantForm>(EMPTY_RESTAURANT_FORM);

  const [menuDrawerOpen, setMenuDrawerOpen] = useState<boolean>(false);
  const [menuRestaurant, setMenuRestaurant] = useState<RestaurantDetail | null>(
    null,
  );
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string>('All');
  const [menuForm, setMenuForm] = useState<MenuItemForm>(EMPTY_MENU_ITEM_FORM);
  const [menuFormOpen, setMenuFormOpen] = useState<boolean>(false);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of restaurants) {
      if (row.category) set.add(row.category);
    }
    return ['ALL', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [restaurants]);

  const menuCategories = useMemo(() => {
    if (!menuRestaurant) return [];
    const categories = menuRestaurant.menu.map((entry) => entry.category);
    return categories.length ? categories : ['Uncategorized'];
  }, [menuRestaurant]);

  const selectedMenuItems = useMemo(() => {
    if (!menuRestaurant) return [];
    const match = menuRestaurant.menu.find(
      (entry) => entry.category === selectedMenuCategory,
    );
    return match?.items ?? [];
  }, [menuRestaurant, selectedMenuCategory]);

  const loadOrders = async (): Promise<void> => {
    setOrdersLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        orderingService.getOrderStats(),
        orderingService.listOrders({
          search: orderSearch.trim() || undefined,
          restaurantId: orderRestaurantId === 'ALL' ? undefined : orderRestaurantId,
          status: orderStatus === 'ALL' ? undefined : (orderStatus as OrderStatus),
          dateFrom: orderDateFrom || undefined,
          dateTo: orderDateTo || undefined,
          page: 1,
          limit: 25,
        }),
      ]);
      setStats(statsRes);
      setOrders(listRes.data);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadRestaurants = async (): Promise<void> => {
    setRestaurantsLoading(true);
    try {
      const list = await orderingService.listRestaurants({ includeInactive: true });
      setRestaurants(list);
    } catch {
      toast.error('Failed to load restaurants');
    } finally {
      setRestaurantsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [orderRestaurantId, orderStatus, orderDateFrom, orderDateTo]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadOrders(), 300);
    return () => window.clearTimeout(t);
  }, [orderSearch]);

  useEffect(() => {
    void loadRestaurants();
  }, []);

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((row) => {
      if (restaurantStatus === 'ACTIVE' && !row.isActive) return false;
      if (restaurantStatus === 'INACTIVE' && row.isActive) return false;
      if (restaurantCategory !== 'ALL' && row.category !== restaurantCategory) return false;
      if (!restaurantSearch.trim()) return true;
      return row.name.toLowerCase().includes(restaurantSearch.trim().toLowerCase());
    });
  }, [restaurants, restaurantSearch, restaurantCategory, restaurantStatus]);

  const orderColumns = useMemo<DataTableColumn<OrderListItem>[]>(
    () => [
      {
        key: 'order',
        header: 'Order #',
        render: (r) => <span className="font-['DM_Mono'] text-[#0F172A]">{r.orderNumber}</span>,
      },
      { key: 'restaurant', header: 'Restaurant', render: (r) => <span className="text-[#0F172A]">{r.restaurantName}</span> },
      { key: 'customer', header: 'Customer', render: (r) => <span className="text-[#0F172A]">{r.userName}</span> },
      { key: 'unit', header: 'Unit', render: (r) => <span className="text-[#0F172A]">{r.unitNumber ?? '-'}</span> },
      { key: 'items', header: 'Items', render: (r) => <span className="text-[#0F172A]">{r.itemCount}</span> },
      {
        key: 'amount',
        header: 'Amount',
        className: 'text-right',
        render: (r) => (
          <span className="block text-right font-['DM_Mono'] text-[#0F172A]">{formatMoney(r.totalAmount)}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (r) => (
          <StatusBadge
            value={r.status}
            className={r.status === OrderStatus.CANCELLED ? 'border-[#E2E8F0] text-[#94A3B8]' : undefined}
          />
        ),
      },
      { key: 'time', header: 'Time', render: (r) => <span className="text-[#64748B]">{formatRelative(r.createdAt)}</span> },
      {
        key: 'actions',
        header: 'Actions',
        className: 'text-right',
        render: (r) => (
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => void openOrderDetail(r.id)} className="rounded p-1.5 text-[#64748B] hover:bg-blue-50 hover:text-[#2563EB]"><Eye className="h-4 w-4" /></button>
            {getNextStatus(r.status) ? (
              <button type="button" onClick={() => void advanceOrder(r.id, r.status)} className="rounded bg-blue-100 p-1.5 text-[#1D4ED8] hover:bg-blue-200" title={quickActionLabel(r.status) ?? ''}><NextActionIcon status={r.status} /></button>
            ) : null}
          </div>
        ),
      },
    ],
    [],
  );

  const openOrderDetail = async (orderId: string): Promise<void> => {
    try {
      const detail = await orderingService.getOrderDetail(orderId);
      setOrderDetail(detail);
      setCancelReason('');
      setCancelExpanded(false);
      setOrderDetailOpen(true);
    } catch {
      toast.error('Failed to load order detail');
    }
  };

  const advanceOrder = async (orderId: string, status: OrderStatus): Promise<void> => {
    const nextStatus = getNextStatus(status);
    if (!nextStatus) return;
    try {
      const updated = await orderingService.updateOrderStatus(orderId, { status: nextStatus });
      if (orderDetail?.id === orderId) setOrderDetail(updated);
      await loadOrders();
    } catch {
      toast.error('Failed to update order status');
    }
  };

  const submitCancel = async (): Promise<void> => {
    if (!orderDetail) return;
    if (!cancelReason.trim()) {
      toast.error('Cancel reason is required');
      return;
    }
    try {
      const updated = await orderingService.cancelOrder(orderDetail.id, cancelReason.trim());
      setOrderDetail(updated);
      setCancelExpanded(false);
      setCancelReason('');
      await loadOrders();
    } catch {
      toast.error('Failed to cancel order');
    }
  };

  const openCreateRestaurant = (): void => {
    setEditingRestaurantId(null);
    setRestaurantForm(EMPTY_RESTAURANT_FORM);
    setRestaurantDrawerOpen(true);
  };

  const openEditRestaurant = async (restaurantId: string): Promise<void> => {
    try {
      const detail = await orderingService.getRestaurantDetail(restaurantId);
      setEditingRestaurantId(restaurantId);
      setRestaurantForm({
        name: detail.name,
        description: detail.description ?? '',
        category: detail.category ?? '',
      });
      setRestaurantDrawerOpen(true);
    } catch {
      toast.error('Failed to load restaurant');
    }
  };

  const saveRestaurant = async (): Promise<void> => {
    if (!restaurantForm.name.trim()) {
      toast.error('Restaurant name is required');
      return;
    }
    try {
      if (editingRestaurantId) {
        await orderingService.updateRestaurant(editingRestaurantId, {
          name: restaurantForm.name.trim(),
          description: restaurantForm.description.trim() || undefined,
          category: restaurantForm.category.trim() || undefined,
        });
      } else {
        await orderingService.createRestaurant({
          name: restaurantForm.name.trim(),
          description: restaurantForm.description.trim() || undefined,
          category: restaurantForm.category.trim() || undefined,
        });
      }
      setRestaurantDrawerOpen(false);
      await loadRestaurants();
      await loadOrders();
    } catch {
      toast.error('Failed to save restaurant');
    }
  };

  const openMenuBuilder = async (restaurantId: string): Promise<void> => {
    try {
      const detail = await orderingService.getRestaurantDetail(restaurantId);
      setMenuRestaurant(detail);
      setSelectedMenuCategory(detail.menu[0]?.category ?? 'Uncategorized');
      setMenuForm(EMPTY_MENU_ITEM_FORM);
      setMenuFormOpen(false);
      setMenuDrawerOpen(true);
    } catch {
      toast.error('Failed to load menu');
    }
  };

  const refreshMenuBuilder = async (): Promise<void> => {
    if (!menuRestaurant) return;
    const detail = await orderingService.getRestaurantDetail(menuRestaurant.id);
    setMenuRestaurant(detail);
    if (!detail.menu.some((entry) => entry.category === selectedMenuCategory)) {
      setSelectedMenuCategory(detail.menu[0]?.category ?? 'Uncategorized');
    }
  };

  const saveMenuItem = async (): Promise<void> => {
    if (!menuRestaurant) return;
    const price = Number(menuForm.price);
    if (!menuForm.name.trim() || !Number.isFinite(price) || price <= 0) {
      toast.error('Name and positive price are required');
      return;
    }
    try {
      if (menuForm.id) {
        await orderingService.updateMenuItem(menuForm.id, {
          name: menuForm.name.trim(),
          description: menuForm.description.trim() || undefined,
          price,
          category: menuForm.category.trim() || selectedMenuCategory,
        });
      } else {
        await orderingService.addMenuItem(menuRestaurant.id, {
          name: menuForm.name.trim(),
          description: menuForm.description.trim() || undefined,
          price,
          category: menuForm.category.trim() || selectedMenuCategory,
        });
      }
      setMenuForm(EMPTY_MENU_ITEM_FORM);
      setMenuFormOpen(false);
      await refreshMenuBuilder();
      await loadRestaurants();
    } catch {
      toast.error('Failed to save menu item');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordering Center"
        description="Monitor live orders and manage restaurant menus."
      />

      <Tabs value={tab} onValueChange={(v: string) => setTab(v as Tab)} className="space-y-6">
        <TabsList className="border border-[#E2E8F0] bg-[#F8FAFC] p-1">
          <TabsTrigger value="orders" className="text-[#64748B] data-[state=active]:bg-white data-[state=active]:text-[#0F172A]">Orders</TabsTrigger>
          <TabsTrigger value="restaurants" className="text-[#64748B] data-[state=active]:bg-white data-[state=active]:text-[#0F172A]">Restaurants</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon="active-users" title="Active Orders" value={String(stats?.activeOrders ?? 0)} />
            <StatCard icon="tickets" title="Delivered Today" value={String(stats?.deliveredToday ?? 0)} />
            <StatCard icon="revenue" title="Revenue Today" value={formatMoney(stats?.revenueToday ?? 0)} />
            <StatCard icon="occupancy" title="Revenue This Month" value={formatMoney(stats?.revenueThisMonth ?? 0)} />
          </div>

          <div className="mb-6 flex items-center gap-0 rounded-xl border border-[#E2E8F0] bg-white p-3">
            {PIPELINE_STAGES.map((stage, i) => {
              const count = stats?.byStatus?.[stage] ?? 0;
              const active = orderStatus === stage;
              return (
                <div key={stage} className="flex items-center">
                  <div className={`flex flex-col items-center rounded-lg px-6 py-3 ${active ? 'border border-blue-200 bg-blue-50' : 'bg-[#F8FAFC]'}`}>
                    <span className={`text-2xl font-semibold font-['DM_Mono'] ${active ? 'text-[#2563EB]' : 'text-[#64748B]'}`}>{count}</span>
                    <span className="mt-0.5 text-xs text-[#64748B]">{stage}</span>
                  </div>
                  {i < PIPELINE_STAGES.length - 1 ? <ChevronRight className="mx-1 h-4 w-4 text-[#E2E8F0]" /> : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <input value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="Search order/customer" className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A]" />
            </div>
            <select value={orderRestaurantId} onChange={(e) => setOrderRestaurantId(e.target.value)} className="w-48 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]"><option value="ALL">All Restaurants</option>{restaurants.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
            <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} className="w-40 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]"><option value="ALL">All Statuses</option>{Object.values(OrderStatus).map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <input type="date" value={orderDateFrom} onChange={(e) => setOrderDateFrom(e.target.value)} className="w-36 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]" />
            <input type="date" value={orderDateTo} onChange={(e) => setOrderDateTo(e.target.value)} className="w-36 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]" />
          </div>

          {ordersLoading ? <SkeletonTable columns={9} /> : (
            <DataTable
              columns={orderColumns}
              rows={orders}
              rowKey={(row) => row.id}
              rowClassName={(row) => `${row.status === OrderStatus.PENDING ? 'border-l-2 border-amber-300' : ''} ${row.status === OrderStatus.CANCELLED ? 'text-[#94A3B8]' : ''}`}
              emptyTitle="No orders found"
              emptyDescription="Orders will appear here once residents place them."
            />
          )}
        </TabsContent>

        <TabsContent value="restaurants" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <input value={restaurantSearch} onChange={(e) => setRestaurantSearch(e.target.value)} placeholder="Search restaurants" className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A]" />
            </div>
            <select value={restaurantCategory} onChange={(e) => setRestaurantCategory(e.target.value)} className="w-44 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]">{categoryOptions.map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All Categories' : value}</option>)}</select>
            <select value={restaurantStatus} onChange={(e) => setRestaurantStatus(e.target.value as RestaurantStatusFilter)} className="w-40 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]"><option value="ALL">All</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
            <button type="button" onClick={openCreateRestaurant} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8]"><Plus className="h-4 w-4" />Add Restaurant</button>
          </div>

          {restaurantsLoading ? <SkeletonTable columns={3} /> : filteredRestaurants.length === 0 ? <EmptyState title="No restaurants found" description="Add a restaurant to start building menus." /> : (
            <div className="grid grid-cols-3 gap-4">
              {filteredRestaurants.map((row) => (
                <div key={row.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F8FAFC] text-lg font-semibold text-[#0F172A]">{row.name.charAt(0).toUpperCase()}</div>
                      <div><p className="text-sm font-semibold text-[#0F172A]">{row.name}</p><StatusBadge value={row.isActive ? 'ACTIVE' : 'INACTIVE'} /></div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-[#64748B]">{row.category ?? 'Uncategorized'}</p>
                  <div className="my-3 border-t border-[#E2E8F0]" />
                  <p className="text-sm text-[#0F172A]">{row.menuItemCount} items • {row.todayOrderCount} orders today</p>
                  <p className="mt-1 font-['DM_Mono'] text-sm text-[#0F172A]">{formatMoney(row.totalRevenue)} this month</p>
                  <div className="mt-4 flex items-center gap-2">
                    <button type="button" onClick={() => void openMenuBuilder(row.id)} className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#0F172A] hover:bg-[#F8FAFC]">Manage Menu</button>
                    <button type="button" onClick={() => void openEditRestaurant(row.id)} className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#0F172A] hover:bg-[#F8FAFC]">Edit</button>
                    <button type="button" onClick={() => void orderingService.toggleRestaurant(row.id).then(loadRestaurants).catch(() => toast.error('Failed to toggle'))} className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#0F172A] hover:bg-[#F8FAFC]">Toggle</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DrawerForm open={orderDetailOpen} onOpenChange={setOrderDetailOpen} title={orderDetail ? orderDetail.orderNumber : 'Order Detail'} widthClassName="w-[480px] max-w-[calc(100vw-24px)]">
        {!orderDetail ? <EmptyState compact title="No order selected" description="Select an order to view details." /> : (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><div><p className="font-['DM_Mono'] text-2xl text-[#0F172A]">{orderDetail.orderNumber}</p><p className="text-sm text-[#64748B]">{orderDetail.restaurant.name}</p></div><StatusBadge value={orderDetail.status} /></div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4"><p className="text-xs uppercase tracking-wider text-[#64748B]">Customer</p><p className="mt-2 text-sm text-[#0F172A]">{orderDetail.user.name}</p><p className="text-sm text-[#64748B]">{orderDetail.user.phone ?? '-'}</p><p className="text-sm text-[#64748B]">Unit: {orderDetail.unit?.unitNumber ?? '-'}</p><p className="mt-1 text-xs text-[#94A3B8]">Ordered at {formatDateTime(orderDetail.createdAt)}</p></div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4"><p className="mb-3 text-xs uppercase tracking-wider text-[#64748B]">Items</p><table className="w-full text-sm"><thead className="text-[#64748B]"><tr><th className="py-1 text-left">Item</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Unit Price</th><th className="py-1 text-right">Subtotal</th></tr></thead><tbody>{orderDetail.items.map((item) => <tr key={item.id} className="border-t border-[#E2E8F0]"><td className="py-2 text-[#0F172A]">{item.menuItemName}</td><td className="py-2 text-right text-[#0F172A]">{item.quantity}</td><td className="py-2 text-right font-['DM_Mono'] text-[#0F172A]">{formatMoney(item.unitPrice)}</td><td className="py-2 text-right font-['DM_Mono'] text-[#0F172A]">{formatMoney(item.subtotal)}</td></tr>)}</tbody></table><div className="mt-3 border-t border-[#E2E8F0] pt-3 text-right"><p className="font-['DM_Mono'] text-lg font-semibold text-[#0F172A]">{formatMoney(orderDetail.totalAmount)}</p></div></div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4"><p className="mb-3 text-xs uppercase tracking-wider text-[#64748B]">Status Timeline</p><div className="space-y-3">{PIPELINE_STAGES.map((stage) => { const reached = PIPELINE_STAGES.indexOf(stage) <= PIPELINE_STAGES.indexOf(orderDetail.status === OrderStatus.CANCELLED ? OrderStatus.PREPARING : orderDetail.status); const current = orderDetail.status === stage; const dotClass = current ? 'bg-[#2563EB] animate-pulse' : reached ? 'bg-emerald-500' : 'bg-[#E2E8F0]'; const stamp = stage === OrderStatus.CONFIRMED ? orderDetail.confirmedAt : stage === OrderStatus.PREPARING ? orderDetail.preparedAt : stage === OrderStatus.DELIVERED ? orderDetail.deliveredAt : orderDetail.createdAt; return <div key={stage} className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} /><div><p className="text-sm text-[#0F172A]">{stage}</p><p className="text-xs text-[#94A3B8]">{stamp ? formatDateTime(stamp) : '-'}</p></div></div>; })}{orderDetail.status === OrderStatus.CANCELLED ? <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /><div><p className="text-sm text-red-700">CANCELLED</p><p className="text-xs text-[#94A3B8]">{orderDetail.cancelledAt ? formatDateTime(orderDetail.cancelledAt) : '-'}</p></div></div> : null}</div></div>
            {orderDetail.status !== OrderStatus.DELIVERED && orderDetail.status !== OrderStatus.CANCELLED ? <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4"><p className="text-xs uppercase tracking-wider text-[#64748B]">Actions</p>{getNextStatus(orderDetail.status) ? <button type="button" onClick={() => void advanceOrder(orderDetail.id, orderDetail.status)} className="rounded-lg bg-[#2563EB] px-3 py-2 text-sm text-white hover:bg-[#1D4ED8]">{quickActionLabel(orderDetail.status)}</button> : null}<button type="button" onClick={() => setCancelExpanded((p) => !p)} className="ml-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100">Cancel Order</button>{cancelExpanded ? <div className="space-y-2"><textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full min-h-[90px] rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]" placeholder="Reason for cancellation" /><button type="button" onClick={() => void submitCancel()} className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700">Confirm Cancel</button></div> : null}</div> : null}
          </div>
        )}
      </DrawerForm>

      <DrawerForm open={restaurantDrawerOpen} onOpenChange={setRestaurantDrawerOpen} title={editingRestaurantId ? 'Edit Restaurant' : 'Add Restaurant'}>
        <div className="space-y-4">
          <input value={restaurantForm.name} onChange={(e) => setRestaurantForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]" />
          <textarea value={restaurantForm.description} onChange={(e) => setRestaurantForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" className="min-h-[90px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]" />
          <input value={restaurantForm.category} onChange={(e) => setRestaurantForm((p) => ({ ...p, category: e.target.value }))} placeholder="Category" className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]" />
          <div className="flex justify-end"><button type="button" onClick={() => void saveRestaurant()} className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm text-white hover:bg-[#1D4ED8]">Save</button></div>
        </div>
      </DrawerForm>

      <DrawerForm open={menuDrawerOpen} onOpenChange={setMenuDrawerOpen} title={menuRestaurant ? `${menuRestaurant.name} - Menu` : 'Menu Builder'} widthClassName="w-full sm:max-w-[720px]">
        {!menuRestaurant ? <EmptyState compact title="No restaurant selected" description="Select a restaurant first." /> : (
          <div className="grid min-h-[560px] grid-cols-[240px_1fr] overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
            <div className="h-full border-r border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="space-y-1">{menuCategories.map((category) => <button key={category} type="button" onClick={() => setSelectedMenuCategory(category)} className={`w-full rounded px-3 py-2 text-left text-sm ${selectedMenuCategory === category ? 'border-r-2 border-[#2563EB] bg-blue-50 text-[#2563EB]' : 'text-[#64748B] hover:text-[#0F172A]'}`}>{category}</button>)}</div>
              <button type="button" onClick={() => { const next = window.prompt('New category name'); if (!next?.trim()) return; setSelectedMenuCategory(next.trim()); setMenuForm((p) => ({ ...p, category: next.trim() })); }} className="mt-4 text-xs text-[#2563EB] hover:text-[#1D4ED8]">+ Add Category</button>
            </div>
            <div className="overflow-y-auto px-6 py-6">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-sm text-[#0F172A]">{selectedMenuCategory}</h3><button type="button" onClick={() => { setMenuFormOpen((p) => !p); if (!menuFormOpen) setMenuForm({ ...EMPTY_MENU_ITEM_FORM, category: selectedMenuCategory }); }} className="rounded-lg bg-[#2563EB] px-3 py-2 text-sm text-white hover:bg-[#1D4ED8]">Add Item</button></div>
              {menuFormOpen ? <div className="mb-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"><div className="grid grid-cols-2 gap-4"><input value={menuForm.name} onChange={(e) => setMenuForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]" /><input value={menuForm.price} onChange={(e) => setMenuForm((p) => ({ ...p, price: e.target.value }))} placeholder="EGP Price" className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]" /><textarea value={menuForm.description} onChange={(e) => setMenuForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" className="col-span-2 min-h-[90px] rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]" /><div className="col-span-2 h-20 rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-3 text-xs text-[#94A3B8]">Photo upload zone</div></div><div className="mt-3 flex items-center gap-2"><button type="button" onClick={() => void saveMenuItem()} className="rounded-lg bg-[#2563EB] px-3 py-2 text-sm text-white hover:bg-[#1D4ED8]">Save</button><button type="button" onClick={() => { setMenuFormOpen(false); setMenuForm(EMPTY_MENU_ITEM_FORM); }} className="rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] hover:bg-[#E8EFF7]">Cancel</button></div></div> : null}
              {selectedMenuItems.map((item) => (
                <div key={item.id} className="mb-2 flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-[#E8EFF7] text-xs text-[#94A3B8]">IMG</div>
                  <div className="flex-1"><p className="text-sm text-[#0F172A]">{item.name}</p><p className="text-xs text-[#64748B]">{item.description ?? '-'}</p></div>
                  <p className="font-['DM_Mono'] text-sm text-[#0F172A]">{formatMoney(item.price)}</p>
                  <button type="button" onClick={() => void orderingService.toggleMenuItem(item.id).then(refreshMenuBuilder).catch(() => toast.error('Failed'))} className="rounded border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#0F172A] hover:bg-[#F8FAFC]">{item.isAvailable ? 'Available' : 'Unavailable'}</button>
                  <button type="button" onClick={() => { setMenuFormOpen(true); setMenuForm({ id: item.id, name: item.name, description: item.description ?? '', price: String(item.price), category: item.category ?? selectedMenuCategory }); }} className="rounded p-1.5 text-[#64748B] hover:bg-blue-50">Edit</button>
                  <button type="button" onClick={() => void orderingService.deleteMenuItem(item.id).then(refreshMenuBuilder).catch(() => toast.error('Failed'))} className="rounded p-1.5 text-red-600 hover:bg-red-50">Delete</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DrawerForm>
    </div>
  );
}
