import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import AddCustomerModal from '../components/AddCustomerModal';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatKES = (n) => `KES ${Number(n).toFixed(0)}`;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Customers</h1>
          <p className="text-gray-500 text-sm">{customers.length} registered customer{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-tulce-500 hover:bg-tulce-400 text-white font-display font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <span>+</span> Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-tulce-500 text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading customers...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500">{search ? 'No customers match your search.' : 'No customers yet. Add your first one!'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => navigate(`/customers/${c.id}`)}
              className="bg-dark-800 border border-dark-600 hover:border-tulce-500/40 rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer transition-all duration-150 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-tulce-500/20 flex items-center justify-center text-tulce-400 font-display font-bold text-sm">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-tulce-300 transition-colors">{c.name}</p>
                  {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total owed</p>
                  <p className="text-sm font-medium text-white">{formatKES(c.totalOwed)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Debt</p>
                  <p className={`text-sm font-bold ${c.debt > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {c.debt > 0 ? formatKES(c.debt) : '✓ Clear'}
                  </p>
                </div>
                <span className="text-gray-600 group-hover:text-gray-400 transition-colors">→</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchCustomers(); }}
        />
      )}
    </div>
  );
}
