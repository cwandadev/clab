// src/routes/admin.index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  ShoppingBag, 
  Users, 
  DollarSign,
  MessageSquare,
  Palette
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  // Mock data - replace with real API data
  const stats = {
    totalRevenue: 16073.49,
    revenueChange: 9.3,
    totalProducts: 156,
    productsChange: 12,
    totalOrders: 89,
    ordersChange: -3,
    totalUsers: 1247,
    usersChange: 18,
    totalMotifs: 34,
    motifsChange: 5,
    unreadChats: 5,
  };

  // Chart data
  const revenueData = [
    { name: 'Jan', value: 12000 },
    { name: 'Feb', value: 13500 },
    { name: 'Mar', value: 14200 },
    { name: 'Apr', value: 12800 },
    { name: 'May', value: 15000 },
    { name: 'Jun', value: 16073 },
  ];

  const ordersData = [
    { name: 'Mon', orders: 12 },
    { name: 'Tue', orders: 19 },
    { name: 'Wed', orders: 15 },
    { name: 'Thu', orders: 22 },
    { name: 'Fri', orders: 28 },
    { name: 'Sat', orders: 18 },
    { name: 'Sun', orders: 10 },
  ];

  const productCategories = [
    { name: 'Components', value: 45 },
    { name: 'Kits', value: 28 },
    { name: 'Digital', value: 35 },
    { name: 'DIY', value: 48 },
  ];

  const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'];

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    color = "blue",
    chartData,
    chartType = "line"
  }: any) => {
    const isPositive = change >= 0;
    
    return (
      <div className="bg-card rounded-lg border border-border p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-${color}-50`}>
              <Icon className={`w-4 h-4 text-${color}-500`} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{title}</span>
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        </div>
        
        <div className="text-2xl font-semibold tracking-tight">
          {typeof value === 'number' && title.toLowerCase().includes('revenue') 
            ? `$${value.toLocaleString()}`
            : value.toLocaleString()}
        </div>

        {chartData && (
          <div className="h-12 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={chartData}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={isPositive ? '#10b981' : '#ef4444'} 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              ) : (
                <AreaChart data={chartData}>
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={isPositive ? '#10b981' : '#ef4444'} 
                    fill={isPositive ? '#10b98120' : '#ef444420'}
                    strokeWidth={2}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground">Welcome back! Here's what's happening with your store.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Last updated: Today at 3:33 AM</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          title="Revenue"
          value={stats.totalRevenue}
          change={stats.revenueChange}
          icon={DollarSign}
          color="blue"
          chartData={revenueData}
        />
        <StatCard
          title="Products"
          value={stats.totalProducts}
          change={stats.productsChange}
          icon={Package}
          color="green"
          chartData={revenueData.slice(0, 4)}
          chartType="area"
        />
        <StatCard
          title="Orders"
          value={stats.totalOrders}
          change={stats.ordersChange}
          icon={ShoppingBag}
          color="orange"
          chartData={ordersData}
        />
        <StatCard
          title="Users"
          value={stats.totalUsers}
          change={stats.usersChange}
          icon={Users}
          color="purple"
          chartData={revenueData.slice(0, 5)}
        />
      </div>

      {/* Additional Stats Row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-medium text-muted-foreground">Motifs</span>
            </div>
            <span className="text-xs text-green-600 font-medium">+{stats.motifsChange}%</span>
          </div>
          <div className="text-2xl font-semibold mt-1">{stats.totalMotifs}</div>
          <div className="h-8 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData.slice(0, 5)}>
                <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-cyan-500" />
              <span className="text-xs font-medium text-muted-foreground">Unread Chats</span>
            </div>
            <span className={`text-xs font-medium ${stats.unreadChats > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stats.unreadChats > 0 ? `${stats.unreadChats} pending` : 'All clear'}
            </span>
          </div>
          <div className="text-2xl font-semibold mt-1">{stats.unreadChats}</div>
          <div className="mt-2 flex items-center gap-1">
            <div className="w-full bg-secondary rounded-full h-1.5">
              <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${(stats.unreadChats / 20) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium text-muted-foreground">Product Categories</span>
            </div>
          </div>
          <div className="h-16 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productCategories}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={30}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {productCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {productCategories.map((cat, i) => (
              <div key={cat.name} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-[10px] text-muted-foreground">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Chart */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Weekly Orders</h3>
          <span className="text-xs text-muted-foreground">Last 7 days</span>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ordersData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="orders" 
                stroke="#3b82f6" 
                fill="#3b82f620"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <button className="bg-card border border-border rounded-lg p-3 text-sm hover:bg-secondary transition-colors text-left">
          <span className="block font-medium">+ New Product</span>
          <span className="text-xs text-muted-foreground">Add to inventory</span>
        </button>
        <button className="bg-card border border-border rounded-lg p-3 text-sm hover:bg-secondary transition-colors text-left">
          <span className="block font-medium">+ New Motif</span>
          <span className="text-xs text-muted-foreground">Add DIY product</span>
        </button>
        <button className="bg-card border border-border rounded-lg p-3 text-sm hover:bg-secondary transition-colors text-left">
          <span className="block font-medium">📦 View Orders</span>
          <span className="text-xs text-muted-foreground">Manage pending orders</span>
        </button>
        <button className="bg-card border border-border rounded-lg p-3 text-sm hover:bg-secondary transition-colors text-left">
          <span className="block font-medium">💬 View Chats</span>
          <span className="text-xs text-muted-foreground">Respond to customers</span>
        </button>
      </div>
    </div>
  );
}