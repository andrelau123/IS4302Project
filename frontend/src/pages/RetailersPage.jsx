import React, { useEffect, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { CONTRACT_ADDRESSES } from '../utils/constants';
import RetailerRegistryABI from '../contracts/RetailerRegistry.json';
import { NETWORK_CONFIG } from '../utils/constants';
import { ethers } from 'ethers';
import demoData from '../data/demoRetailers.json';

export default function RetailersPage() {
  const { provider, account, signer, formatAddress } = useWallet();
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [isBrandManager, setIsBrandManager] = useState(false);
  const [reputationMap, setReputationMap] = useState({});

  useEffect(() => {
    const entries = demoData.retailers || [];
    const overrides = JSON.parse(localStorage.getItem('retailerOverrides') || '{}');
    setRetailers(entries.map(e => ({
      address: e.address,
      name: overrides[e.address]?.name || e.name,
      reputationScore: 'N/A',
      totalProductsHandled: undefined,
      registeredAt: null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!provider || !CONTRACT_ADDRESSES.RETAILER_REGISTRY) return;
    let cancelled = false;
    (async () => {
      try {
  const registry = new ethers.Contract(CONTRACT_ADDRESSES.RETAILER_REGISTRY, RetailerRegistryABI.abi || RetailerRegistryABI, provider);
        const entries = demoData.retailers || [];
        const results = [];
        for (const e of entries) {
          try {
            const r = await registry.retailers(e.address);
            const overrides = JSON.parse(localStorage.getItem('retailerOverrides') || '{}');
            const local = overrides[e.address] || {};
            results.push({
              address: e.address,
              name: local.name || r.name || e.name,
              reputationScore: r.reputationScore?.toString ? r.reputationScore.toString() : r.reputationScore,
              totalProductsHandled: r.totalProductsHandled?.toString ? r.totalProductsHandled.toString() : r.totalProductsHandled,
              registeredAt: parseInt(r.registeredAt || 0, 10),
            });
          } catch (_) {
            const overrides = JSON.parse(localStorage.getItem('retailerOverrides') || '{}');
            const local = overrides[e.address] || {};
            results.push({ address: e.address, name: local.name || e.name, reputationScore: 'N/A' });
          }
        }
        if (!cancelled) setRetailers(results);
      } catch (e) {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [provider]);

  const loadReputationBreakdown = async (addr) => {
    try {
      if (!CONTRACT_ADDRESSES.RETAILER_REGISTRY) return { __error: 'RETAILER_REGISTRY address missing' };
      const rpcUrl = process.env.REACT_APP_RPC_URL || NETWORK_CONFIG.rpcUrl;
      const rpcProvider = provider || new ethers.JsonRpcProvider(rpcUrl);
  const registry = new ethers.Contract(CONTRACT_ADDRESSES.RETAILER_REGISTRY, RetailerRegistryABI.abi || RetailerRegistryABI, rpcProvider);
      const breakdown = await registry.getReputationBreakdown(addr);
      const data = {
        successScore: breakdown[0].toString(),
        volumeScore: breakdown[1].toString(),
        tenureScore: breakdown[2].toString(),
        responseScore: breakdown[3].toString(),
        disputeScore: breakdown[4].toString(),
        consistencyScore: breakdown[5].toString(),
        decayMultiplier: breakdown[6].toString(),
        compositeScore: breakdown[7].toString(),
      };
      setReputationMap(m => ({ ...m, [addr]: data }));
      console.log('[RetailersPage] getReputationBreakdown', addr, data);
      return data;
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      console.error('[RetailersPage] getReputationBreakdown failed for', addr, msg, e);
      setReputationMap(m => ({ ...m, [addr]: { __error: msg } }));
      return { __error: msg };
    }
  };

  const refreshAllReputations = async () => {
    const entries = demoData.retailers || [];
    for (const e of entries) {
      await loadReputationBreakdown(e.address).catch((err) => console.error('refreshAll error', err));
    }
    // Update visible list from reputationMap
    setRetailers(list => list.map(item => ({ ...item, reputationScore: (reputationMap[item.address] && !reputationMap[item.address].__error) ? reputationMap[item.address].compositeScore : item.reputationScore })));
  };

  useEffect(() => {
    (async () => {
      const entries = demoData.retailers || [];
      for (const e of entries) {
        const data = await loadReputationBreakdown(e.address).catch(() => ({ __error: 'unknown' }));
        if (data && !data.__error) setRetailers(list => list.map(item => item.address === e.address ? { ...item, reputationScore: data.compositeScore } : item));
        else console.debug('[RetailersPage] no reputation for', e.address, data && data.__error);
      }
    })();
  }, []);

  useEffect(() => {
    if (!signer || !account || !CONTRACT_ADDRESSES.RETAILER_REGISTRY) return;
    (async () => {
      try {
  const registry = new ethers.Contract(CONTRACT_ADDRESSES.RETAILER_REGISTRY, RetailerRegistryABI.abi || RetailerRegistryABI, signer);
        const role = await registry.BRAND_MANAGER_ROLE();
        const ok = await registry.hasRole(role, account);
        setIsBrandManager(Boolean(ok));
      } catch (e) {
        // ignore
      }
    })();
  }, [signer, account]);

  return (
    <div className="pt-20 p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Retailer Registry</h1>
      {retailers.length === 0 && <p>No demo retailers found.</p>}
      <div className="space-y-4">
        {retailers.map(r => (
          <div key={r.address} className="p-4 border rounded">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{r.name}</div>
                <div className="text-sm text-gray-600">{r.address === account ? `${formatAddress(r.address)} (you)` : r.address}</div>
              </div>
              <div>
                {account && account.toLowerCase() === r.address.toLowerCase() && (
                  <button className="text-sm px-2 py-1 border rounded bg-blue-50" onClick={() => setEditing(s => ({ ...s, [r.address]: { name: r.name } }))}>Edit</button>
                )}
              </div>
            </div>

            <div className="mt-2">Reputation: {r.reputationScore ?? 'N/A'}</div>
            <div>Products handled: {r.totalProductsHandled ?? '—'}</div>
            <div>Registered: {r.registeredAt ? new Date(r.registeredAt * 1000).toLocaleString() : '—'}</div>

            <div className="mt-2 flex gap-2">
              <button className="px-3 py-1 bg-gray-200 rounded mr-2" onClick={refreshAllReputations}>Refresh reputations</button>
              <button className="px-3 py-1 bg-indigo-100 rounded" onClick={async () => {
                const cached = reputationMap[r.address];
                const data = (cached && !cached.__error) ? cached : await loadReputationBreakdown(r.address);
                if (!data || data.__error) {
                  console.error('[RetailersPage] reputation load error', r.address, data && data.__error);
                  return alert('No reputation data available: ' + (data && data.__error ? data.__error : 'unknown'));
                }
                alert(`Composite: ${data.compositeScore}\nSuccess: ${data.successScore}\nVolume: ${data.volumeScore}`);
              }}>View reputation breakdown</button>

              {isBrandManager && (
                <>
                  <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={async () => {
                    if (!signer) return alert('Connect wallet as brand manager');
                    try {
                      const registry = new ethers.Contract(CONTRACT_ADDRESSES.RETAILER_REGISTRY, RetailerRegistryABI.abi || RetailerRegistryABI, signer);
                      const tx = await registry.registerRetailer(r.address, r.name || 'Demo Retailer');
                      await tx.wait();
                      alert('Retailer registered on-chain');
                      window.location.reload();
                    } catch (e) { alert('Failed to register: ' + (e?.message || e)); }
                  }}>Register on-chain</button>

                  <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={async () => {
                    if (!signer) return alert('Connect wallet as brand manager');
                    try {
                      const registry = new ethers.Contract(CONTRACT_ADDRESSES.RETAILER_REGISTRY, RetailerRegistryABI.abi || RetailerRegistryABI, signer);
                      const tx = await registry.authorizeRetailerForBrand(account, r.address);
                      await tx.wait();
                      alert('Retailer authorized for your brand');
                      window.location.reload();
                    } catch (e) { alert('Failed to authorize: ' + (e?.message || e)); }
                  }}>Authorize for my brand</button>
                </>
              )}
            </div>

            {editing[r.address] && (
              <div className="mt-3 p-3 bg-gray-50 border rounded">
                <label className="block text-sm font-medium text-gray-700">Display name</label>
                <input value={editing[r.address].name} onChange={(e) => setEditing(s => ({ ...s, [r.address]: { name: e.target.value } }))} className="mt-1 p-2 border rounded w-full" />
                <div className="mt-2 flex gap-2">
                  <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => {
                    const overrides = JSON.parse(localStorage.getItem('retailerOverrides') || '{}');
                    overrides[r.address] = { ...(overrides[r.address] || {}), name: editing[r.address].name };
                    localStorage.setItem('retailerOverrides', JSON.stringify(overrides));
                    setRetailers(list => list.map(item => item.address === r.address ? { ...item, name: editing[r.address].name } : item));
                    setEditing(s => { const copy = { ...s }; delete copy[r.address]; return copy; });
                  }}>Save (local)</button>
                  <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setEditing(s => { const copy = { ...s }; delete copy[r.address]; return copy; })}>Cancel</button>
                  <button className="px-3 py-1 bg-yellow-100 rounded" onClick={() => {
                    const msg = `Please update retailer name on-chain for ${r.address} to: "${editing[r.address].name}". Requester: ${account || 'N/A'}`;
                    navigator.clipboard?.writeText(msg);
                    alert('Request copied to clipboard. Share with your brand manager to update on-chain.');
                  }}>Copy request for on-chain change</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
