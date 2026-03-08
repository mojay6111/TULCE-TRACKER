import { useState } from "react";
import api from "../api";
export default function PaymentModal({ order, onClose, onSuccess }) {
  const [method, setMethod] = useState("CASH"); const [amount, setAmount] = useState(order.balance); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => { e.preventDefault(); if (!amount||amount<=0) return setError("Enter a valid amount."); setError(""); setLoading(true); try { await api.post("/payments", { orderId:order.id, amount, method }); onSuccess(); } catch (err) { setError(err.response?.data?.error||"Could not record payment."); } finally { setLoading(false); } };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold text-white mb-1">Record Payment</h2>
        <p className="text-gray-500 text-xs mb-4">Outstanding: <span className="text-red-400 font-semibold">KES {order.balance}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Payment Method</label><div className="grid grid-cols-2 gap-2">{["CASH","MPESA"].map(m => (<button key={m} type="button" onClick={() => setMethod(m)} className={`py-3 rounded-lg text-sm font-semibold font-display transition-all ${method===m ? m==="MPESA"?"bg-green-600 text-white border border-green-500":"bg-blue-600 text-white border border-blue-500" : "bg-dark-700 text-gray-400 border border-dark-500 hover:border-gray-500"}`}>{m==="MPESA"?"📱 M-Pesa":"💵 Cash"}</button>))}</div></div>
          <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Amount (KES)</label><input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} min="1" max={order.balance} step="1" required className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-tulce-500 text-sm" /><p className="text-xs text-gray-600 mt-1">Max: KES {order.balance}</p></div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1"><button type="button" onClick={onClose} className="flex-1 bg-dark-700 hover:bg-dark-600 text-gray-300 py-2.5 rounded-lg text-sm transition-colors">Cancel</button><button type="submit" disabled={loading} className="flex-1 bg-tulce-500 hover:bg-tulce-400 disabled:bg-tulce-700 text-white font-display font-semibold py-2.5 rounded-lg text-sm transition-colors">{loading?"Saving...":"Mark as Paid"}</button></div>
        </form>
      </div>
    </div>
  );
}
