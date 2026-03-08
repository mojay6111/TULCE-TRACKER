import { useState, useEffect } from 'react';
import api from '../api';
import NewOrderModal from '../components/NewOrderModal';

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className={`bg-dark-800 border ${accent || 'border-dark-600'} rounded-xl p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="font-display text-2xl font-bold text-white">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    PAID: 'badge-paid',
    UNPAID: 'badge-unpaid',
    PARTIAL: 'badge-partial'
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'badge-unpaid'}`}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const formatKES = (n) => `KES ${Number(n).toFixed(0)}`;
  const formatDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-3">🍩</div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { today, debtors, totalDebt, days } = data;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm">{formatDate(today.date)} — Today's overview</p>
        </div>
        <button
          onClick={() => setShowOrderModal(true)}
          className="bg-tulce-500 hover:bg-tulce-400 text-white font-display font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <span>+</span> New Order
        </button>
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard icon="🍩" label="Tulces Sold" value={today.tulces} sub="today" />
        <StatCard icon="💰" label="Revenue" value={formatKES(today.revenue)} sub="today" />
        <StatCard icon="✅" label="Collected" value={formatKES(today.collected)} sub="cash + mpesa" accent="border-emerald-800/50" />
        <StatCard icon="⏳" label="Unpaid" value={formatKES(today.unpaid)} sub="today only" accent={today.unpaid > 0 ? "border-red-800/50" : "border-dark-600"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Today's orders */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <h2 className="font-display text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Today's Orders</h2>
          {today.orders.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p className="text-3xl mb-2">🍩</p>
              <p className="text-sm">No orders today yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {today.orders.map(order => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{order.customer.name}</p>
                    <p className="text-xs text-gray-500">{order.quantity} tulce{order.quantity !== 1 ? 's' : ''} × KES 5</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{formatKES(order.totalAmount)}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Debt Ledger */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm font-semibold text-gray-300 uppercase tracking-wider">Debt Ledger</h2>
            {totalDebt > 0 && (
              <span className="text-xs text-red-400 font-medium">Total: {formatKES(totalDebt)}</span>
            )}
          </div>
          {debtors.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-sm">Everyone is settled up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {debtors.map(d => (
                <div key={d.customerId} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
                  <p className="text-sm font-medium text-white">{d.name}</p>
                  <span className="text-sm font-semibold text-red-400">{formatKES(d.debt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Days History */}
      {days.length > 0 && (
        <div className="mt-5 bg-dark-800 border border-dark-600 rounded-xl p-4">
          <h2 className="font-display text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Day-by-Day History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Tulces</th>
                  <th className="pb-2 pr-4">Revenue</th>
                  <th className="pb-2 pr-4">Collected</th>
                  <th className="pb-2">Unpaid</th>
                </tr>
              </thead>
              <tbody>
                {days.map(day => (
                  <tr key={day.date} className="border-t border-dark-700">
                    <td className="py-2 pr-4 text-gray-300">{formatDate(day.date)}</td>
                    <td className="py-2 pr-4 text-white font-medium">{day.tulces}</td>
                    <td className="py-2 pr-4 text-white">{formatKES(day.revenue)}</td>
                    <td className="py-2 pr-4 text-emerald-400">{formatKES(day.collected)}</td>
                    <td className={`py-2 font-medium ${day.revenue - day.collected > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                      {formatKES(day.revenue - day.collected)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showOrderModal && (
        <NewOrderModal
          onClose={() => setShowOrderModal(false)}
          onSuccess={() => { setShowOrderModal(false); fetchDashboard(); }}
        />
      )}
    </div>
  );
}
