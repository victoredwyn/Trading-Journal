import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Plus, BarChart3, AlertCircle, CheckCircle, Cloud, Settings, X, Trash2 } from 'lucide-react';

export default function TradingJournal() {
  // STATE MANAGEMENT
  const [trades, setTrades] = useState([]);
  const [activeTab, setActiveTab] = useState('journal');
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [syncInterval, setSyncInterval] = useState('realtime');
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [formData, setFormData] = useState({
    pair: '',
    direction: 'long',
    strategy: '',
    entryPrice: '',
    targetPrice: '',
    stopLossPrice: '',
    entryTime: new Date().toISOString().slice(0, 16),
    exitPrice: '',
    exitTime: '',
    notes: '',
  });

  // LOAD TRADES ON MOUNT
  useEffect(() => {
    const loadTrades = async () => {
      try {
        const result = await window.storage.get('trades-zella-v2');
        if (result) {
          setTrades(JSON.parse(result.value));
        }
      } catch (error) {
        console.log('No saved trades');
      }
    };
    loadTrades();
  }, []);

  // UTILITY FUNCTIONS
  const calculateMetrics = (trade) => {
    const entry = parseFloat(trade.entryPrice);
    const target = parseFloat(trade.targetPrice);
    const stop = parseFloat(trade.stopLossPrice);
    const isLong = trade.direction === 'long';

    const risk = isLong ? entry - stop : stop - entry;
    const reward = isLong ? target - entry : entry - target;
    const rr = risk > 0 ? (reward / risk).toFixed(2) : 0;

    let pnl = null;
    let pnlPercent = null;

    if (trade.exitPrice) {
      const exit = parseFloat(trade.exitPrice);
      pnl = isLong ? (exit - entry) : (entry - exit);
      pnlPercent = ((pnl / entry) * 100).toFixed(2);
    }

    return { risk: risk.toFixed(2), reward: reward.toFixed(2), rr, pnl, pnlPercent };
  };

  // SAVE & SYNC
  const saveTrades = async (newTrades) => {
    try {
      await window.storage.set('trades-zella-v2', JSON.stringify(newTrades));
      setTrades(newTrades);
      if (syncInterval === 'realtime') {
        setSyncStatus('syncing');
        setLastSyncTime(new Date());
        setSyncStatus('synced');
      }
    } catch (error) {
      console.error('Save failed', error);
      setSyncStatus('error');
    }
  };

  // CSV EXPORT
  const exportCSV = () => {
    const headers = ['ID', 'Pair', 'Direction', 'Strategy', 'Entry', 'Target', 'Stop', 'Exit', 'Entry Time', 'Exit Time', 'P&L', 'P&L %', 'Status', 'Notes'];
    
    const rows = trades.map(t => {
      const m = calculateMetrics(t);
      return [
        t.id,
        t.pair,
        t.direction,
        t.strategy || '',
        t.entryPrice,
        t.targetPrice,
        t.stopLossPrice,
        t.exitPrice || '',
        t.entryTime,
        t.exitTime || '',
        m.pnl !== null ? m.pnl.toFixed(2) : '',
        m.pnlPercent || '',
        t.status,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-journal-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // CSV IMPORT
  const importCSV = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result;
        const lines = csv.split('\n');
        const imported = [];

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;

          const values = lines[i].match(/(".*?"|[^,]*)/g)?.map(v => v.trim().replace(/^"|"$/g, '').replace('""', '"')) || [];

          const trade = {
            id: parseInt(values[0]) || Date.now() + i,
            pair: values[1] || '',
            direction: values[2] || 'long',
            strategy: values[3] || '',
            entryPrice: values[4] || '',
            targetPrice: values[5] || '',
            stopLossPrice: values[6] || '',
            exitPrice: values[7] || '',
            entryTime: values[8] || '',
            exitTime: values[9] || '',
            status: values[12] || 'open',
            notes: values[13] || '',
            createdAt: new Date().toISOString(),
          };

          if (trade.pair) imported.push(trade);
        }

        if (imported.length > 0) {
          const merged = [...trades, ...imported].reduce((unique, t) => 
            unique.find(u => u.id === t.id) ? unique : [...unique, t], []
          );
          saveTrades(merged);
          alert(`✅ Imported ${imported.length} trades`);
        }
      } catch (error) {
        alert('❌ Error parsing CSV');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // TRADE ACTIONS
  const addTrade = () => {
    if (!formData.pair || !formData.entryPrice || !formData.targetPrice || !formData.stopLossPrice) {
      alert('Fill all required fields');
      return;
    }

    const newTrade = {
      id: Date.now(),
      ...formData,
      createdAt: new Date().toISOString(),
      status: formData.exitPrice ? 'closed' : 'open',
    };

    saveTrades([...trades, newTrade]);
    resetForm();
    setShowForm(false);
  };

  const closeTrade = (id, exitPrice, exitTime) => {
    if (!exitPrice) {
      alert('Enter exit price');
      return;
    }
    const updated = trades.map(t => 
      t.id === id ? { ...t, exitPrice, exitTime, status: 'closed' } : t
    );
    saveTrades(updated);
  };

  const deleteTrade = (id) => {
    if (confirm('Delete this trade?')) {
      saveTrades(trades.filter(t => t.id !== id));
    }
  };

  const resetForm = () => {
    setFormData({
      pair: '',
      direction: 'long',
      strategy: '',
      entryPrice: '',
      targetPrice: '',
      stopLossPrice: '',
      entryTime: new Date().toISOString().slice(0, 16),
      exitPrice: '',
      exitTime: '',
      notes: '',
    });
  };

  // ANALYTICS
  const closedTrades = trades.filter(t => t.status === 'closed');
  const openTrades = trades.filter(t => t.status === 'open');
  const winningTrades = closedTrades.filter(t => (calculateMetrics(t).pnl || 0) > 0);
  const losingTrades = closedTrades.filter(t => (calculateMetrics(t).pnl || 0) < 0);

  const totalPnL = closedTrades.reduce((sum, t) => sum + (calculateMetrics(t).pnl || 0), 0);
  const winRate = closedTrades.length > 0 ? ((winningTrades.length / closedTrades.length) * 100).toFixed(1) : 0;
  const avgWin = winningTrades.length > 0 
    ? (winningTrades.reduce((sum, t) => sum + (calculateMetrics(t).pnl || 0), 0) / winningTrades.length).toFixed(2) 
    : 0;
  const avgLoss = losingTrades.length > 0 
    ? (losingTrades.reduce((sum, t) => sum + (calculateMetrics(t).pnl || 0), 0) / losingTrades.length).toFixed(2) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 font-['Inter']">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Trade Journal</h1>
              <p className="text-xs text-slate-500">Track • Analyze • Improve</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {syncStatus === 'synced' && (
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                Synced
              </div>
            )}

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Sync settings"
            >
              <Cloud className="w-5 h-5 text-slate-600" />
            </button>

            <button
              onClick={exportCSV}
              className="text-xs font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Export
            </button>

            <label className="text-xs font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
              Import
              <input type="file" accept=".csv" onChange={importCSV} className="hidden" />
            </label>

            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold px-4 py-2 rounded-lg transition-all shadow-lg hover:shadow-blue-200"
            >
              <Plus className="w-5 h-5" />
              Add Trade
            </button>
          </div>
        </div>
      </header>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">Sync Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {[
                { value: 'realtime', label: 'Real-Time', desc: 'Instant sync' },
                { value: 'hourly', label: 'Hourly', desc: 'Once per hour' },
                { value: 'daily', label: 'Daily', desc: 'Once per day' },
                { value: 'manual', label: 'Manual', desc: 'Click to sync' }
              ].map(option => (
                <label key={option.value} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="sync"
                    value={option.value}
                    checked={syncInterval === option.value}
                    onChange={(e) => setSyncInterval(e.target.value)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{option.label}</div>
                    <div className="text-xs text-slate-500">{option.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* TABS */}
        <div className="flex gap-8 mb-8 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('journal')}
            className={`pb-3 px-1 font-semibold text-sm transition-all ${
              activeTab === 'journal'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Journal
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-3 px-1 font-semibold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>
        </div>

        {/* ADD TRADE FORM */}
        {showForm && (
          <div className="mb-8 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-6">New Trade</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <input
                type="text"
                placeholder="Pair (EURUSD)"
                value={formData.pair}
                onChange={(e) => setFormData({ ...formData, pair: e.target.value.toUpperCase() })}
                className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <select
                value={formData.direction}
                onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="long">LONG</option>
                <option value="short">SHORT</option>
              </select>
              <input
                type="text"
                placeholder="Strategy"
                value={formData.strategy}
                onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">Entry</label>
                <input
                  type="number"
                  step="0.00001"
                  placeholder="1.0850"
                  value={formData.entryPrice}
                  onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">Target</label>
                <input
                  type="number"
                  step="0.00001"
                  placeholder="1.0950"
                  value={formData.targetPrice}
                  onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">Stop</label>
                <input
                  type="number"
                  step="0.00001"
                  placeholder="1.0750"
                  value={formData.stopLossPrice}
                  onChange={(e) => setFormData({ ...formData, stopLossPrice: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">Time</label>
                <input
                  type="datetime-local"
                  value={formData.entryTime}
                  onChange={(e) => setFormData({ ...formData, entryTime: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs font-semibold text-slate-700 block mb-2">Notes</label>
              <textarea
                placeholder="Trade reasoning..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 h-20 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={addTrade}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold py-3 rounded-lg transition-all shadow-lg hover:shadow-blue-200"
              >
                Add Trade
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* JOURNAL VIEW */}
        {activeTab === 'journal' && (
          <div className="space-y-6">
            {/* OPEN TRADES */}
            {openTrades.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-4">Open Positions ({openTrades.length})</h2>
                <div className="space-y-4">
                  {openTrades.map(trade => {
                    const m = calculateMetrics(trade);
                    return (
                      <div key={trade.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                              <TrendingUp className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{trade.pair}</div>
                              <div className={`text-xs font-semibold ${trade.direction === 'long' ? 'text-emerald-600' : 'text-red-600'}`}>
                                {trade.direction.toUpperCase()}
                              </div>
                            </div>
                            {trade.strategy && (
                              <div className="ml-4 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                {trade.strategy}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => deleteTrade(trade.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                          <div className="bg-slate-50 rounded-lg p-3">
                            <div className="text-xs text-slate-600 mb-1">Entry</div>
                            <div className="font-mono font-bold text-slate-900">{trade.entryPrice}</div>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-3">
                            <div className="text-xs text-emerald-700 mb-1">Target</div>
                            <div className="font-mono font-bold text-emerald-600">{trade.targetPrice}</div>
                          </div>
                          <div className="bg-red-50 rounded-lg p-3">
                            <div className="text-xs text-red-700 mb-1">Stop</div>
                            <div className="font-mono font-bold text-red-600">{trade.stopLossPrice}</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3">
                            <div className="text-xs text-slate-600 mb-1">Risk</div>
                            <div className="font-mono font-bold text-slate-900">{m.risk}</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3">
                            <div className="text-xs text-slate-600 mb-1">Reward</div>
                            <div className="font-mono font-bold text-slate-900">{m.reward}</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <div className="text-xs text-blue-700 mb-1">R:R</div>
                            <div className="font-mono font-bold text-blue-600">1:{m.rr}</div>
                          </div>
                        </div>

                        <div className="border-t border-slate-200 pt-4">
                          <h4 className="text-xs font-semibold text-slate-700 mb-3">Close Position</h4>
                          <div className="flex gap-3">
                            <input
                              type="number"
                              step="0.00001"
                              placeholder="Exit price"
                              id={`exit-${trade.id}`}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                            <input
                              type="datetime-local"
                              id={`exit-time-${trade.id}`}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                            <button
                              onClick={() => {
                                const exitPrice = document.getElementById(`exit-${trade.id}`).value;
                                const exitTime = document.getElementById(`exit-time-${trade.id}`).value;
                                closeTrade(trade.id, exitPrice, exitTime);
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                        {trade.notes && <p className="text-sm text-slate-600 mt-3">{trade.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CLOSED TRADES */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-4">Closed Trades ({closedTrades.length})</h2>
              {closedTrades.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No closed trades yet</div>
              ) : (
                <div className="space-y-4">
                  {[...closedTrades].reverse().map(trade => {
                    const m = calculateMetrics(trade);
                    const isWin = m.pnl > 0;
                    return (
                      <div
                        key={trade.id}
                        className={`bg-white border rounded-xl p-6 hover:shadow-md transition-all ${
                          isWin ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                              isWin ? 'bg-emerald-100' : 'bg-red-100'
                            }`}>
                              {isWin ? (
                                <CheckCircle className="w-6 h-6 text-emerald-600" />
                              ) : (
                                <TrendingDown className="w-6 h-6 text-red-600" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{trade.pair}</div>
                              <div className={`text-xs font-semibold ${trade.direction === 'long' ? 'text-emerald-600' : 'text-red-600'}`}>
                                {trade.direction.toUpperCase()}
                              </div>
                            </div>
                            {trade.strategy && (
                              <div className="ml-4 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full">
                                {trade.strategy}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => deleteTrade(trade.id)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-3">
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="text-xs text-slate-600 mb-1">Entry</div>
                            <div className="font-mono font-bold text-slate-900">{trade.entryPrice}</div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="text-xs text-slate-600 mb-1">Exit</div>
                            <div className="font-mono font-bold text-slate-900">{trade.exitPrice}</div>
                          </div>
                          <div className="bg-emerald-100 rounded-lg p-3 border border-emerald-200">
                            <div className="text-xs text-emerald-700 mb-1">Target</div>
                            <div className="font-mono font-bold text-emerald-600">{trade.targetPrice}</div>
                          </div>
                          <div className="bg-red-100 rounded-lg p-3 border border-red-200">
                            <div className="text-xs text-red-700 mb-1">Stop</div>
                            <div className="font-mono font-bold text-red-600">{trade.stopLossPrice}</div>
                          </div>
                          <div className={`rounded-lg p-3 border ${isWin ? 'bg-emerald-100 border-emerald-200' : 'bg-red-100 border-red-200'}`}>
                            <div className={`text-xs mb-1 ${isWin ? 'text-emerald-700' : 'text-red-700'}`}>P&L</div>
                            <div className={`font-mono font-bold text-lg ${isWin ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isWin ? '+' : ''}{m.pnl.toFixed(2)}
                            </div>
                          </div>
                          <div className={`rounded-lg p-3 border ${isWin ? 'bg-emerald-100 border-emerald-200' : 'bg-red-100 border-red-200'}`}>
                            <div className={`text-xs mb-1 ${isWin ? 'text-emerald-700' : 'text-red-700'}`}>%</div>
                            <div className={`font-mono font-bold text-lg ${isWin ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isWin ? '+' : ''}{m.pnlPercent}%
                            </div>
                          </div>
                        </div>
                        {trade.notes && <p className="text-sm text-slate-600">{trade.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS VIEW */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                <div className="text-slate-600 text-sm font-semibold mb-2">Total P&L</div>
                <div className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500 mt-2">{closedTrades.length} closed trades</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                <div className="text-slate-600 text-sm font-semibold mb-2">Win Rate</div>
                <div className="text-3xl font-bold text-blue-600">{winRate}%</div>
                <div className="text-xs text-slate-500 mt-2">{winningTrades.length}W / {losingTrades.length}L</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                <div className="text-slate-600 text-sm font-semibold mb-2">Avg Win</div>
                <div className="text-3xl font-bold text-emerald-600">{avgWin}</div>
                <div className="text-xs text-slate-500 mt-2">{winningTrades.length} winning trades</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                <div className="text-slate-600 text-sm font-semibold mb-2">Avg Loss</div>
                <div className="text-3xl font-bold text-red-600">{avgLoss}</div>
                <div className="text-xs text-slate-500 mt-2">{losingTrades.length} losing trades</div>
              </div>
            </div>

            {/* ALERTS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                Trading Alerts
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-700 font-semibold">Today's trades</span>
                  <span className="text-slate-900 font-bold">
                    {trades.filter(t => new Date(t.createdAt).toDateString() === new Date().toDateString()).length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-700 font-semibold">Low R:R (&lt;1.5)</span>
                  <span className="text-slate-900 font-bold">
                    {trades.filter(t => parseFloat(calculateMetrics(t).rr) < 1.5).length}
                  </span>
                </div>
              </div>
            </div>

            {/* TOP TRADES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">🏆 Best Trades</h3>
                <div className="space-y-2">
                  {winningTrades.slice(0, 5).map(t => {
                    const m = calculateMetrics(t);
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <span className="font-semibold text-slate-900">{t.pair}</span>
                        <span className="text-emerald-600 font-bold">+{m.pnl.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">📉 Worst Trades</h3>
                <div className="space-y-2">
                  {losingTrades.slice(0, 5).map(t => {
                    const m = calculateMetrics(t);
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                        <span className="font-semibold text-slate-900">{t.pair}</span>
                        <span className="text-red-600 font-bold">{m.pnl.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
