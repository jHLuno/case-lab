"use client";

import { useState, useEffect } from "react";
import { supabase, Lead } from "../lib/supabase";
import { ArrowLeft, RefreshCw, Search, Filter } from "lucide-react";

const CRM_PASSWORD = process.env.NEXT_PUBLIC_CRM_PASSWORD || "caselab2026";

export default function CRMPage() {
  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Lead["status"]>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("crm_auth") : null;
    if (saved === CRM_PASSWORD) setAuth(true);
  }, []);

  useEffect(() => {
    if (!auth) return;
    loadLeads();
  }, [auth]);

  const loadLeads = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from("leads") as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLeads(data as Lead[]);
    }
    setLoading(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CRM_PASSWORD) {
      localStorage.setItem("crm_auth", password);
      setAuth(true);
    } else {
      alert("Неверный пароль");
    }
  };

  const updateStatus = async (id: number, status: Lead["status"]) => {
    await (supabase.from("leads") as any).update({ status }).eq("id", id);
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status } : l))
    );
  };

  const filtered = leads.filter((l) => {
    const matchesFilter = filter === "all" || l.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      (l.company && l.company.toLowerCase().includes(q)) ||
      (l.phone && l.phone.toLowerCase().includes(q));
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

  if (!auth) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
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
              className="w-full px-4 py-3 rounded-[12px] border border-black/[0.08] bg-white text-black text-[15px] placeholder:text-black/30 focus:outline-none focus:border-[#040082]/30 focus:ring-1 focus:ring-[#040082]/10 transition-all duration-200"
              style={{ fontFamily: "var(--font-body)" }}
            />
            <button
              type="submit"
              className="w-full bg-[#040082] text-white px-6 py-3 rounded-full text-[15px] font-normal hover:bg-[#0600a8] transition-colors duration-300"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Войти
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
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-6 md:px-10 py-8 md:py-12">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
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
              onClick={loadLeads}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/[0.08] bg-white text-black text-[14px] hover:bg-black/5 transition-colors"
              style={{ fontFamily: "var(--font-body)" }}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Обновить
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-1 text-black/40 text-[14px] hover:text-black transition-colors"
              style={{ fontFamily: "var(--font-body)" }}
            >
              <ArrowLeft size={14} /> На сайт
            </a>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, email, компании..."
              className="w-full pl-9 pr-4 py-2.5 rounded-[12px] border border-black/[0.08] bg-white text-black text-[14px] placeholder:text-black/30 focus:outline-none focus:border-[#040082]/30 transition-all"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>
          <div className="flex items-center gap-2">
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

        {/* Table */}
        <div className="bg-white rounded-[16px] border border-black/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/[0.08]">
                  <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>Имя</th>
                  <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>Контакты</th>
                  <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal hidden md:table-cell" style={{ fontFamily: "var(--font-body)" }}>Компания</th>
                  <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal hidden lg:table-cell" style={{ fontFamily: "var(--font-body)" }}>Сообщение</th>
                  <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>Статус</th>
                  <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>Дата</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-black/30 text-[14px]" style={{ fontFamily: "var(--font-body)" }}>
                      Загрузка...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-black/30 text-[14px]" style={{ fontFamily: "var(--font-body)" }}>
                      {search || filter !== "all" ? "Ничего не найдено" : "Пока нет заявок"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((lead) => (
                    <tr key={lead.id} className="border-b border-black/[0.05] hover:bg-black/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-black text-[14px] font-normal" style={{ fontFamily: "var(--font-body)" }}>
                          {lead.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <a href={`mailto:${lead.email}`} className="block text-[#040082] text-[13px] hover:underline" style={{ fontFamily: "var(--font-body)" }}>
                            {lead.email}
                          </a>
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="block text-black/40 text-[12px] hover:text-black transition-colors" style={{ fontFamily: "var(--font-body)" }}>
                              {lead.phone}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-black/60 text-[13px]" style={{ fontFamily: "var(--font-body)" }}>
                          {lead.company || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell max-w-[200px]">
                        <span className="text-black/40 text-[12px] line-clamp-2" style={{ fontFamily: "var(--font-body)" }}>
                          {lead.message || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.status}
                          onChange={(e) => updateStatus(lead.id, e.target.value as Lead["status"])}
                          className={`px-2 py-1 rounded-full text-[11px] font-normal border-0 cursor-pointer ${statusColors[lead.status]}`}
                          style={{ fontFamily: "var(--font-body)" }}
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
