
// Updated React app with Google Sheets backend via Apps Script Web App
// Instructions:
// 1. Create a Google Sheet with columns: id, a, b, aImg, bImg, votesA, votesB, createdAt
// 2. Create an Apps Script bound to the sheet and publish as a Web App (execute as: Me, allow anyone with link).
// 3. Set the WEB_APP_URL constant below to your Apps Script deployment URL.
// 4. The script must implement two actions: "list" (GET) and "update" (POST).

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ---- CONFIG ----
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwn03WiDtUAZRcjSksIqJtfz_R_V6wsPQTFu2MuAgrkoVCyg4ZmhS644IdGXc2aId0IIw/exec"; 

export default function MincePieVoteApp() {
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ a: "", b: "", aImg: "", bImg: "" });
  const [filter, setFilter] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`${WEB_APP_URL}?action=list`);
      const data = await res.json();
      setComparisons(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load sheet data", e);
    }
    setLoading(false);
  }

  async function saveData(next) {
    setSaving(true);
    try {
      await fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", data: next }),
      });
    } catch (e) {
      console.error("Failed to save sheet data", e);
    }
    setSaving(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function sync(next) {
    setComparisons(next);
    saveData(next);
  }

  function addComparison(e) {
    e && e.preventDefault();
    const row = {
      id: Date.now() + Math.random(),
      a: form.a.trim(),
      b: form.b.trim(),
      aImg: form.aImg.trim(),
      bImg: form.bImg.trim(),
      votesA: 0,
      votesB: 0,
      createdAt: new Date().toISOString(),
    };
    const next = [row, ...comparisons];
    sync(next);
    setForm({ a: "", b: "", aImg: "", bImg: "" });
    setShowAdd(false);
  }

  function vote(id, side) {
    const next = comparisons.map((c) =>
      c.id === id
        ? {
            ...c,
            votesA: side === "A" ? c.votesA + 1 : c.votesA,
            votesB: side === "B" ? c.votesB + 1 : c.votesB,
          }
        : c
    );
    sync(next);
  }

  function resetVotes(id) {
    if (!confirm("Reset votes?")) return;
    const next = comparisons.map((c) =>
      c.id === id ? { ...c, votesA: 0, votesB: 0 } : c
    );
    sync(next);
  }

  function deleteComparison(id) {
    if (!confirm("Delete this comparison?")) return;
    const next = comparisons.filter((c) => c.id !== id);
    sync(next);
  }

  const filtered = comparisons.filter(
    (c) =>
      c.a.toLowerCase().includes(filter.toLowerCase()) ||
      c.b.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold">Mince Pie Vote (Sheet-backed)</h1>
          <button
            className="px-3 py-2 border rounded bg-white shadow"
            onClick={() => setShowAdd(true)}
          >
            Add Comparison
          </button>
        </header>

        {loading && (
          <div className="p-6 bg-white rounded shadow">Loading sheet…</div>
        )}

        <div className="mb-4">
          <input
            className="p-2 border rounded w-full"
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {saving && (
          <div className="text-sm text-gray-500 mb-2">Saving…</div>
        )}

        <main className="space-y-4">
          {filtered.map((c) => {
            const total = c.votesA + c.votesB;
            const pctA = total ? Math.round((c.votesA / total) * 100) : 50;
            const pctB = 100 - pctA;
            return (
              <div key={c.id} className="p-4 bg-white border rounded shadow-sm">
                <div className="flex justify-between mb-3">
                  <div className="font-semibold">{c.a}</div>
                  <div className="font-semibold">{c.b}</div>
                </div>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => vote(c.id, "A")} className="flex-1 border rounded p-2 bg-white">
                    Vote A
                  </button>
                  <button onClick={() => vote(c.id, "B")} className="flex-1 border rounded p-2 bg-white">
                    Vote B
                  </button>
                </div>
                <div className="text-sm text-gray-600">{total} vote(s)</div>
                <div className="w-full h-4 bg-slate-100 rounded overflow-hidden mt-1">
                  <div className="h-full bg-amber-200 inline-block" style={{ width: `${pctA}%` }} />
                  <div className="h-full bg-slate-300 inline-block" style={{ width: `${pctB}%` }} />
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span>A: {c.votesA} ({pctA}%)</span>
                  <span>B: {c.votesB} ({pctB}%)</span>
                </div>
                <div className="flex justify-end gap-2 mt-3 text-xs">
                  <button onClick={() => resetVotes(c.id)} className="border px-2 py-1 rounded bg-white">
                    Reset
                  </button>
                  <button onClick={() => deleteComparison(c.id)} className="border px-2 py-1 rounded bg-white">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </main>

        <AnimatePresence>
          {showAdd && (
            <motion.div className="fixed inset-0 flex items-center justify-center bg-black/30">
              <form className="bg-white p-6 rounded w-full max-w-lg" onSubmit={addComparison}>
                <h2 className="text-xl font-semibold mb-3">New comparison</h2>
                <input
                  className="w-full p-2 border rounded mb-3"
                  placeholder="Left pie name"
                  required
                  value={form.a}
                  onChange={(e) => setForm({ ...form, a: e.target.value })}
                />
                <input
                  className="w-full p-2 border rounded mb-3"
                  placeholder="Left image URL (optional)"
                  value={form.aImg}
                  onChange={(e) => setForm({ ...form, aImg: e.target.value })}
                />
                <input
                  className="w-full p-2 border rounded mb-3"
                  placeholder="Right pie name"
                  required
                  value={form.b}
                  onChange={(e) => setForm({ ...form, b: e.target.value })}
                />
                <input
                  className="w-full p-2 border rounded mb-3"
                  placeholder="Right image URL (optional)"
                  value={form.bImg}
                  onChange={(e) => setForm({ ...form, bImg: e.target.value })}
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAdd(false)} className="border px-3 py-2 rounded bg-white">
                    Cancel
                  </button>
                  <button type="submit" className="px-3 py-2 rounded bg-amber-200">
                    Add
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
