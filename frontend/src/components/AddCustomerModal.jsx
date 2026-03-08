import { useState } from "react";
import api from "../api";
export default function AddCustomerModal({ onClose, onSuccess }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => { e.preventDefault(); setError(""); setLoading(true); try { await api.post("/customers", { name, phone }); onSuccess(); } catch (err) { setError(err.response?.data?.error || "Could not add customer."); } finally { setLoading(false); } };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold text-white mb-4">Add New Customer</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Name *</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kamau" required className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-tulce-500 text-sm" /></div>
          <div><label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Phone (optional)</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XX XXX XXX" className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-tulce-500 text-sm" /></div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1"><button type="button" onClick={onClose} className="flex-1 bg-dark-700 hover:bg-dark-600 text-gray-300 py-2.5 rounded-lg text-sm transition-colors">Cancel</button><button type="submit" disabled={loading} className="flex-1 bg-tulce-500 hover:bg-tulce-400 disabled:bg-tulce-700 text-white font-display font-semibold py-2.5 rounded-lg text-sm transition-colors">{loading?"Adding...":"Add Customer"}</button></div>
        </form>
      </div>
    </div>
  );
}
