import { useState, useEffect } from "react";
import api from "../api";
const PRICE = 5;
export default function NewOrderModal({ onClose, onSuccess }) {
  const [customers, setCustomers] = useState([]); const [customerId, setCustomerId] = useState(""); const [quantity, setQuantity] = useState(1); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { api.get("/customers").then(res => setCustomers(res.data)).catch(console.error); }, []);
  const handleSubmit = async (e) => { e.preventDefault(); if (!customerId) return setError("Please select a customer."); setError(""); setLoading(true); try { await api.post("/orders", { customerId, quantity }); onSuccess(); } catch (err) { setError(err.response?.data?.error || "Could not create order."); } finally { setLoading(false); } };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold text-white mb-1">New Order</h2>
        <p className="text-gray-500 text-xs mb-4">KES 5 per tulce</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Customer *</label><select value={customerId} onChange={e => setCustomerId(e.target.value)} required className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-tulce-500 text-sm"><option value="">Select a customer...</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Number of Tulces</label><div className="flex items-center gap-3"><button type="button" onClick={() => setQuantity(q => Math.max(1,q-1))} className="w-10 h-10 bg-dark-700 hover:bg-dark-600 rounded-lg text-white font-bold text-lg transition-colors">−</button><input type="number" value={quantity} onChange={e => setQuantity(Math.max(1,parseInt(e.target.value)||1))} min="1" className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white text-center focus:outline-none focus:border-tulce-500 text-sm" /><button type="button" onClick={() => setQuantity(q => q+1)} className="w-10 h-10 bg-dark-700 hover:bg-dark-600 rounded-lg text-white font-bold text-lg transition-colors">+</button></div></div>
          <div className="bg-tulce-500/10 border border-tulce-500/20 rounded-lg p-3 flex justify-between items-center"><span className="text-sm text-gray-400">Total amount</span><span className="font-display text-lg font-bold text-tulce-400">KES {quantity*PRICE}</span></div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1"><button type="button" onClick={onClose} className="flex-1 bg-dark-700 hover:bg-dark-600 text-gray-300 py-2.5 rounded-lg text-sm transition-colors">Cancel</button><button type="submit" disabled={loading} className="flex-1 bg-tulce-500 hover:bg-tulce-400 disabled:bg-tulce-700 text-white font-display font-semibold py-2.5 rounded-lg text-sm transition-colors">{loading?"Creating...":"Record Order"}</button></div>
        </form>
      </div>
    </div>
  );
}
