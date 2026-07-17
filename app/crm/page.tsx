"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, RefreshCw, Search, Filter, Trash2, Save, X, Pencil } from "lucide-react";

type Lead = {
  id: number;
  name: string;
  phone: string;
  position: string | null;
  notes: string | null;
  status: "new" | "contacted" | "scheduled" | "completed" | "cancelled";
  created_at: string;
};

type Source = "main" | "evp-pro";

const sourceTabs: { value: Source; label: string }[] = [
  { value: "main", label: "Сайт" },
  { value: "evp-pro", label: "EVP Pro" },
];

export default function CRMPage() {
  const [password, setPassword] = useState("");
  const [source, setSource] = useState<Source>("main");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | Lead["status"]>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<Lead["status"]>("new");
  const [saving, setSaving] = useState(false);

  // Check existing session on mount + handle bfcache restoration
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/check");
        if (res.ok) {
          setIsAuthenticated(true);
          await fetchLeads();
        }
      } catch {
        // Not authenticated
      } finally {
        setChecking(false);
      }
    };
    checkAuth();

    // Reset auth when restored from back-forward cache (Chrome bfcache)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setIsAuthenticated(false);
        setLeads([]);
        setPassword("");
        setError("");
        setChecking(false);
        setEditingId(null);
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const switchSource = async (next: Source) => {
    if (next === source) return;
    setSource(next);
    setFilter("all");
    setSearch("");
    setEditingId(null);
    await fetchLeads(next);
  };

  const fetchLeads = async (sourceOverride?: Source) => {
    const activeSource = sourceOverride ?? source;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/crm/?source=${activeSource}`);

      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false);
          setError("Сессия истекла. Войдите снова.");
        } else {
          setError("Ошибка сервера");
        }
        setLeads([]);
        return;
      }

      const data = await res.json();
      setLeads(data.leads || []);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("Неверный пароль");
        } else if (res.status === 503) {
          setError("CRM не настроен");
        } else {
          setError("Ошибка сервера");
        }
        return;
      }

      setIsAuthenticated(true);
      await fetchLeads();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore
    }
    setIsAuthenticated(false);
    setPassword("");
    setLeads([]);
    setError("");
    setEditingId(null);
  };

  const startEdit = (lead: Lead) => {
    setEditingId(lead.id);
    setEditStatus(lead.status);
    setEditNotes(lead.notes || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNotes("");
    setEditStatus("new");
  };

  const saveLead = async (id: number) => {
    setSaving(true);
    try {
      const res = await fetch("/api/crm/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, source, status: editStatus, notes: editNotes || null }),
      });

      if (!res.ok) {
        throw new Error("Failed to update");
      }

      setLeads((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, status: editStatus, notes: editNotes || null } : l
        )
      );
      setEditingId(null);
    } catch {
      setError("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const deleteLead = async (id: number) => {
    if (!confirm("Удалить заявку? Это действие нельзя отменить.")) return;

    try {
      const res = await fetch("/api/crm/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, source }),
      });

      if (!res.ok) {
        throw new Error("Failed to delete");
      }

      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch {
      setError("Ошибка удаления");
    }
  };

  const filtered = leads.filter((l) => {
    const matchesFilter = filter === "all" || l.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.phone.toLowerCase().includes(q) ||
      (l.position && l.position.toLowerCase().includes(q)) ||
      (l.notes && l.notes.toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  const statusColors: Record<Lead["status"], string> = {
    new: "bg-amber-100 text-amber-700",
    contacted: "bg-blue-100 text-blue-700",
    scheduled: "bg-emerald-100 text-emerald-700",
    completed: "bg-gray-100 text-gray-600",
    cancelled: "bg-red-100 text-red-700",
  };

  const statusLabels: Record<Lead["status"], string> = {
    new: "Новая",
    contacted: "Связались",
    scheduled: "Записаны",
    completed: "Проведена",
    cancelled: "Отменена",
  };

  if (checking) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-black/40 text-[14px]" style={{ fontFamily: "var(--font-body)" }}>
          Загрузка...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      {!isAuthenticated ? (
          <div className="w-full max-w-sm">
            <h1
              className="text-black text-[24px] font-bold leading-[1.15] uppercase tracking-[0.02em] mb-8 text-center"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              CRM Case Lab
            </h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                autoComplete="off"
                className="w-full px-4 py-3 rounded-[12px] border border-black/[0.08] bg-white text-black text-[15px] placeholder:text-black/30 focus:outline-none focus:border-[#040082]/30 focus:ring-1 focus:ring-[#040082]/10 transition-all duration-200"
                style={{ fontFamily: "var(--font-body)" }}
              />
              {error && (
                <p className="text-red-600 text-[13px]" style={{ fontFamily: "var(--font-body)" }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#040082] text-white px-6 py-3 rounded-full text-[15px] font-normal hover:bg-[#0600a8] transition-colors duration-300 disabled:opacity-60"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {loading ? "Загрузка..." : "Войти"}
              </button>
            </form>
            <p className="text-center mt-4">
              <a
                href="/"
                className="inline-flex items-center gap-1 text-black/40 text-[14px] hover:text-black transition-colors"
                style={{ fontFamily: "var(--font-body)" }}
              >
                <ArrowLeft size={14} /> На сайт
              </a>
            </p>
          </div>
        ) : (
          <div className="min-h-screen bg-[#fafafa] px-6 md:px-10 py-8 md:py-12 w-full">
            <div className="max-w-[1400px] mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h1
                    className="text-black text-[24px] md:text-[32px] font-bold leading-[1.15] uppercase tracking-[0.02em]"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Заявки
                  </h1>
                  <p className="text-gray text-[14px] mt-1" style={{ fontFamily: "var(--font-body)" }}>
                    {leads.length} заявок всего
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fetchLeads()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/[0.08] bg-white text-black text-[14px] hover:bg-black/5 transition-colors"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    Обновить
                  </button>
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 text-black/40 text-[14px] hover:text-black transition-colors"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    <ArrowLeft size={14} /> Выйти
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-6">
                {sourceTabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => switchSource(tab.value)}
                    className={`px-4 py-2 rounded-full text-[13px] transition-all ${
                      source === tab.value
                        ? "bg-black text-white"
                        : "bg-white text-black/50 border border-black/[0.08] hover:bg-black/5"
                    }`}
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {error && (
                <p className="text-red-600 text-[14px] mb-4" style={{ fontFamily: "var(--font-body)" }}>
                  {error}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск по имени, телефону, должности, заметкам..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-[12px] border border-black/[0.08] bg-white text-black text-[14px] placeholder:text-black/30 focus:outline-none focus:border-[#040082]/30 transition-all"
                    style={{ fontFamily: "var(--font-body)" }}
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter size={14} className="text-black/30" />
                  {(["all", "new", "contacted", "scheduled", "completed", "cancelled"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={`px-3 py-1.5 rounded-full text-[12px] transition-all ${
                        filter === s
                          ? "bg-[#040082] text-white"
                          : "bg-white text-black/50 border border-black/[0.08] hover:bg-black/5"
                      }`}
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {s === "all" ? "Все" : statusLabels[s as Lead["status"]]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-[16px] border border-black/[0.08] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-black/[0.08]">
                        <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal w-[200px]" style={{ fontFamily: "var(--font-body)" }}>Имя</th>
                        <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>Телефон</th>
                        <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal hidden md:table-cell" style={{ fontFamily: "var(--font-body)" }}>Должность</th>
                        <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal w-[140px]" style={{ fontFamily: "var(--font-body)" }}>Статус</th>
                        <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal hidden lg:table-cell w-[300px]" style={{ fontFamily: "var(--font-body)" }}>Заметки</th>
                        <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>Дата</th>
                        <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal w-[80px]" style={{ fontFamily: "var(--font-body)" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-black/30 text-[14px]" style={{ fontFamily: "var(--font-body)" }}>
                            Загрузка...
                          </td>
                        </tr>
                      ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-black/30 text-[14px]" style={{ fontFamily: "var(--font-body)" }}>
                            {search || filter !== "all" ? "Ничего не найдено" : "Пока нет заявок"}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((lead) => {
                          const isEditing = editingId === lead.id;
                          return (
                            <tr key={lead.id} className="border-b border-black/[0.05] hover:bg-black/[0.02] transition-colors">
                              <td className="px-4 py-3">
                                <span className="text-black text-[14px] font-normal" style={{ fontFamily: "var(--font-body)" }}>
                                  {lead.name}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <a href={`tel:${lead.phone}`} className="text-[#040082] text-[13px] hover:underline" style={{ fontFamily: "var(--font-body)" }}>
                                    {lead.phone}
                                  </a>
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="text-black/60 text-[13px]" style={{ fontFamily: "var(--font-body)" }}>
                                  {lead.position || "—"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {isEditing ? (
                                  <select
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value as Lead["status"])}
                                    className="w-full px-2 py-1.5 rounded-[8px] border border-black/[0.12] bg-white text-black text-[12px] focus:outline-none focus:border-[#040082]/30"
                                    style={{ fontFamily: "var(--font-body)" }}
                                  >
                                    {(Object.entries(statusLabels) as [Lead["status"], string][]).map(([value, label]) => (
                                      <option key={value} value={value}>{label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={`px-2 py-1 rounded-full text-[11px] font-normal ${statusColors[lead.status]}`}>
                                    {statusLabels[lead.status]}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="Заметки..."
                                    className="w-full px-2 py-1.5 rounded-[8px] border border-black/[0.12] bg-white text-black text-[12px] placeholder:text-black/30 focus:outline-none focus:border-[#040082]/30"
                                    style={{ fontFamily: "var(--font-body)" }}
                                  />
                                ) : (
                                  <span className="text-black/50 text-[12px]" style={{ fontFamily: "var(--font-body)" }}>
                                    {lead.notes || "—"}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-black/30 text-[12px] whitespace-nowrap" style={{ fontFamily: "var(--font-body)" }}>
                                  {new Date(lead.created_at).toLocaleDateString("ru-RU", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() => saveLead(lead.id)}
                                        disabled={saving}
                                        className="p-1.5 rounded-full bg-[#040082] text-white hover:bg-[#0600a8] transition-colors disabled:opacity-50"
                                        title="Сохранить"
                                      >
                                        <Save size={14} />
                                      </button>
                                      <button
                                        onClick={cancelEdit}
                                        className="p-1.5 rounded-full bg-black/5 text-black/40 hover:bg-black/10 transition-colors"
                                        title="Отмена"
                                      >
                                        <X size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => startEdit(lead)}
                                        className="p-1.5 rounded-full bg-black/5 text-black/40 hover:bg-black/10 hover:text-black/60 transition-colors"
                                        title="Редактировать"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        onClick={() => deleteLead(lead.id)}
                                        className="p-1.5 rounded-full bg-black/5 text-black/40 hover:bg-red-50 hover:text-red-600 transition-colors"
                                        title="Удалить"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
      )}
    </main>
  );
}
