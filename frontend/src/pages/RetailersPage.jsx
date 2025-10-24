import React, { useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { CONTRACT_ADDRESSES } from '../utils/constants';
import RetailerRegistryABI from '../contracts/RetailerRegistry.json';
import demoData from '../data/demoRetailers.json';

export default function RetailersPage() {
  const { provider, account, signer, formatAddress } = useWallet();
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (!provider) return;
        const registry = new (window.ethers?.Contract || (await import('ethers').then(m => m.ethers)).Contract)(
          CONTRACT_ADDRESSES.RETAILER_REGISTRY,
          RetailerRegistryABI,
          provider
        );

        const entries = demoData.retailers || [];
        const results = [];
        for (const e of entries) {
          try {
            const r = await registry.retailers(e.address);
            // Allow local overrides (stored in localStorage)
            const overrides = JSON.parse(localStorage.getItem('retailerOverrides') || '{}');
            const local = overrides[e.address] || {};
            results.push({
              address: e.address,
              name: local.name || r.name || e.name,
              reputationScore: r.reputationScore?.toString ? r.reputationScore.toString() : r.reputationScore,
              totalProductsHandled: r.totalProductsHandled?.toString ? r.totalProductsHandled.toString() : r.totalProductsHandled,
              registeredAt: parseInt(r.registeredAt || 0, 10)
            });
          } catch (err) {
            console.warn('Could not fetch retailer from chain, using demo data:', e.address, err?.message || err);
            const overrides = JSON.parse(localStorage.getItem('retailerOverrides') || '{}');
            const local = overrides[e.address] || {};
            results.push({ address: e.address, name: local.name || e.name, reputationScore: 'N/A' });
          }
        }

        setRetailers(results);
      } catch (err) {
        console.error('Error loading retailers:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [provider]);

  return (
    <div className="pt-20 p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Retailer Registry</h1>
      {loading ? (
        <p>Loading retailers…</p>
      ) : (
        <div className="space-y-4">
          {retailers.length === 0 && <p>No demo retailers found.</p>}
          {retailers.map((r) => (
            <div key={r.address} className="p-4 border rounded">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-sm text-gray-600">{r.address === account ? `${formatAddress(r.address)} (you)` : r.address}</div>
                </div>
                <div>
                  {account && account.toLowerCase() === r.address.toLowerCase() && (
                    <button
                      className="text-sm px-2 py-1 border rounded bg-blue-50"
                      onClick={() => setEditing((s) => ({ ...s, [r.address]: { name: r.name } }))}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2">Reputation: {r.reputationScore}</div>
              <div>Products handled: {r.totalProductsHandled ?? '—'}</div>
              <div>Registered: {r.registeredAt ? new Date(r.registeredAt * 1000).toLocaleString() : '—'}</div>

              {editing[r.address] && (
                <div className="mt-3 p-3 bg-gray-50 border rounded">
                  <label className="block text-sm font-medium text-gray-700">Display name</label>
                  <input
                    value={editing[r.address].name}
                    onChange={(e) => setEditing((s) => ({ ...s, [r.address]: { name: e.target.value } }))}
                    className="mt-1 p-2 border rounded w-full"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      className="px-3 py-1 bg-green-600 text-white rounded"
                      onClick={() => {
                        const overrides = JSON.parse(localStorage.getItem('retailerOverrides') || '{}');
                        overrides[r.address] = { ...(overrides[r.address] || {}), name: editing[r.address].name };
                        localStorage.setItem('retailerOverrides', JSON.stringify(overrides));
                        setRetailers((list) => list.map(item => item.address === r.address ? { ...item, name: editing[r.address].name } : item));
                        setEditing((s) => { const copy = { ...s }; delete copy[r.address]; return copy; });
                      }}
                    >Save (local)</button>
                    <button
                      className="px-3 py-1 bg-gray-200 rounded"
                      onClick={() => setEditing((s) => { const copy = { ...s }; delete copy[r.address]; return copy; })}
                    >Cancel</button>
                    <button
                      className="px-3 py-1 bg-yellow-100 rounded"
                      onClick={() => {
                        // copy a request message to clipboard so user can ask brand manager to change name on-chain
                        const msg = `Please update retailer name on-chain for ${r.address} to: "${editing[r.address].name}". Requester: ${account || 'N/A'}`;
                        navigator.clipboard?.writeText(msg);
                        alert('Request copied to clipboard. Share with your brand manager to update on-chain.');
                      }}
                    >Copy request for on-chain change</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
