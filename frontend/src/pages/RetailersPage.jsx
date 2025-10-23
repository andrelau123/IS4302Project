import React, { useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { CONTRACT_ADDRESSES } from '../utils/constants';
import RetailerRegistryABI from '../contracts/RetailerRegistry.json';
import demoData from '../data/demoRetailers.json';

export default function RetailersPage() {
  const { provider } = useWallet();
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);

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
            results.push({
              address: e.address,
              name: r.name || e.name,
              reputationScore: r.reputationScore?.toString ? r.reputationScore.toString() : r.reputationScore,
              totalProductsHandled: r.totalProductsHandled?.toString ? r.totalProductsHandled.toString() : r.totalProductsHandled,
              registeredAt: parseInt(r.registeredAt || 0, 10)
            });
          } catch (err) {
            console.warn('Could not fetch retailer from chain, using demo data:', e.address, err?.message || err);
            results.push({ address: e.address, name: e.name, reputationScore: 'N/A' });
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
              <div className="font-semibold">{r.name}</div>
              <div className="text-sm text-gray-600">{r.address}</div>
              <div>Reputation: {r.reputationScore}</div>
              <div>Products handled: {r.totalProductsHandled ?? '—'}</div>
              <div>Registered: {r.registeredAt ? new Date(r.registeredAt * 1000).toLocaleString() : '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
