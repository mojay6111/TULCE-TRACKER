import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import PaymentModal from "../components/PaymentModal";

function StatusBadge({ status }) {
  const map = {
    PAID: "badge-paid",
    UNPAID: "badge-unpaid",
    PARTIAL: "badge-partial",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status]}`}
    >
      {status}
    </span>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchCustomer = async () => {
    try {
      const res = await api.get(`/customers/${id}`);
      setCustomer(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const formatKES = (n) => `KES ${Number(n).toFixed(0)}`;
  const formatDate = (d) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-KE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const formatTime = (dt) =>
    new Date(dt).toLocaleTimeString("en-KE", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleDeleteOrder = async (orderId) => {
    if (!confirm("Delete this order and its payments?")) return;
    try {
      await api.delete(`/orders/${orderId}`);
      fetchCustomer();
    } catch (err) {
      alert("Could not delete order.");
    }
  };

  const handleDeleteCustomer = async () => {
    if (
      !confirm(
        `Delete ${customer.name} and all their data? This cannot be undone.`,
      )
    )
      return;
    try {
      await api.delete(`/customers/${id}`);
      navigate("/customers");
    } catch (err) {
      alert("Could not delete customer.");
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading...
      </div>
    );
  if (!customer)
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Customer not found.
      </div>
    );

  const sortedDays = Object.keys(customer.ordersByDay).sort((a, b) =>
    b.localeCompare(a),
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-fade-in">
      {/* Back */}
      <button
        onClick={() => navigate("/customers")}
        className="text-gray-500 hover:text-gray-300 text-sm mb-4 flex items-center gap-1 transition-colors"
      >
        ← Back to Customers
      </button>

      {/* Header */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-tulce-500/20 flex items-center justify-center text-tulce-400 font-display font-bold text-xl">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-white">
                {customer.name}
              </h1>
              {customer.phone && (
                <p className="text-sm text-gray-500">{customer.phone}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleDeleteCustomer}
            className="text-xs text-red-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-900/20"
          >
            Delete Customer
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-dark-700 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Owed</p>
            <p className="font-display text-lg font-bold text-white">
              {formatKES(customer.totalOwed)}
            </p>
          </div>
          <div className="bg-dark-700 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Total Paid</p>
            <p className="font-display text-lg font-bold text-emerald-400">
              {formatKES(customer.totalPaid)}
            </p>
          </div>
          <div
            className={`rounded-lg p-3 text-center ${customer.debt > 0 ? "bg-red-900/20 border border-red-800/40" : "bg-emerald-900/20 border border-emerald-800/40"}`}
          >
            <p className="text-xs text-gray-500 mb-1">Outstanding</p>
            <p
              className={`font-display text-lg font-bold ${customer.debt > 0 ? "text-red-400" : "text-emerald-400"}`}
            >
              {customer.debt > 0 ? formatKES(customer.debt) : "✓ Clear"}
            </p>
          </div>
        </div>
      </div>

      {/* Order History by Day */}
      <h2 className="font-display text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Order History
      </h2>

      {sortedDays.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <p className="text-3xl mb-2">🍩</p>
          <p>No orders yet for this customer.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDays.map((day) => {
            const orders = customer.ordersByDay[day];
            const dayTotal = orders.reduce((s, o) => s + o.totalAmount, 0);
            const dayPaid = orders.reduce((s, o) => s + o.amountPaid, 0);
            const dayDebt = dayTotal - dayPaid;

            return (
              <div
                key={day}
                className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden"
              >
                {/* Day header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-dark-700/50">
                  <div>
                    <p className="text-sm font-display font-semibold text-white">
                      {formatDate(day)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {orders.length} order{orders.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      Day total: {formatKES(dayTotal)}
                    </p>
                    {dayDebt > 0 && (
                      <p className="text-xs text-red-400">
                        Unpaid: {formatKES(dayDebt)}
                      </p>
                    )}
                    {dayDebt <= 0 && (
                      <p className="text-xs text-emerald-400">✓ Fully paid</p>
                    )}
                  </div>
                </div>

                {/* Orders */}
                <div className="divide-y divide-dark-700">
                  {orders.map((order) => (
                    <div key={order.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-white font-medium">
                              {order.quantity} tulce
                              {order.quantity !== 1 ? "s" : ""} × KES 5 ={" "}
                              {formatKES(order.totalAmount)}
                            </p>
                            <StatusBadge status={order.status} />
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatTime(order.date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {order.balance > 0 && (
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="text-xs bg-tulce-500/20 text-tulce-400 border border-tulce-500/30 hover:bg-tulce-500/30 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Mark Paid
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="text-xs text-red-500/60 hover:text-red-400 transition-colors px-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Payments for this order */}
                      {order.payments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {order.payments.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center gap-2 text-xs text-gray-500"
                            >
                              <span
                                className={
                                  p.method === "MPESA"
                                    ? "text-green-500"
                                    : "text-blue-400"
                                }
                              >
                                {p.method === "MPESA" ? "📱 M-Pesa" : "💵 Cash"}
                              </span>
                              <span>+{formatKES(p.amount)}</span>
                              <span>@ {formatTime(p.paidAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {order.balance > 0 && (
                        <p className="text-xs text-red-400 mt-1">
                          Balance: {formatKES(order.balance)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <PaymentModal
          order={selectedOrder}
          customerPhone={customer?.phone || ""}
          onClose={() => setSelectedOrder(null)}
          onSuccess={() => {
            setSelectedOrder(null);
            fetchCustomer();
          }}
        />
      )}
    </div>
  );
}
