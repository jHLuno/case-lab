"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, RefreshCw, Search, Filter } from "lucide-react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const CRM_PASSWORD = "caselab2026";
const CRM_AUTH_HEADER = { "x-crm-auth": "caselab-crm-2026" };

type Lead = {
  id: number;
  name: string;
  phone: string;
  position: string | null;
  status: "new" | "contacted" | "scheduled" | "completed" | "cancelled";
  created_at: string;
};

function getCrmSupabase() {
  return createClient(SUPABASE_URL || "https://placeholder.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvaXJnZmJicGhjdmNlZmVhdnB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTIxNDUsImV4cCI6MjA5NDE2ODE0NX0.bMwJEE-qm3PpHFOs4LLzFsuXC5mQ1WM0e7B_7064tcQ", {
    auth: { persistSession: false },
    global: { headers: CRM_AUTH_HEADER },
  });
}

export default function CRMPage() {
  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Lead["status"]>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!auth) return;
    loadLeads();
  }, [auth]);

  const loadLeads = async () => {
    setLoading(true);
    const supabase = getCrmSupabase();
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
      setAuth(true);
    } else {
      alert("Неверный пароль");
    }
  };

  const filtered = leads.filter((l) => {
    const matchesFilter = filter === "all" || l.status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.phone.toLowerCase().includes(q) ||
      (l.position && l.position.toLowerCase().includes(q));
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

  return (
    <>
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <title>CRM — Case Lab</title>
      </head>
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        {!auth ? (
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
        ) : (
          <div className="min-h-screen bg-[#fafafa] px-6 md:px-10 py-8 md:py-12 w-full">
            <div className="max-w-[1200px] mx-auto">
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
                  <button
                    onClick={() => { setAuth(false); setPassword(""); setLeads([]); }}
                    className="inline-flex items-center gap-1 text-black/40 text-[14px] hover:text-black transition-colors"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    <ArrowLeft size={14} /> Выйти
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск по имени, телефону, должности..."
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

              <div className="bg-white rounded-[16px] border border-black/[0.08] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-black/[0.08]">
                        <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>Имя</th>
                        <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>Телефон</th>
                        <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal hidden md:table-cell" style={{ fontFamily: "var(--font-body)" }}>Должность</th>
                        <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>Статус</th>
                        <th className="text-left px-4 py-3 text-black/40 text-[11px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-black/30 text-[14px]" style={{ fontFamily: "var(--font-body)" }}>
                            Загрузка...
                          </td>
                        </tr>
                      ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-black/30 text-[14px]" style={{ fontFamily: "var(--font-body)" }}>
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
                              <a href={`tel:${lead.phone}`} className="text-[#040082] text-[13px] hover:underline" style={{ fontFamily: "var(--font-body)" }}>
                                {lead.phone}
                              </a>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className="text-black/60 text-[13px]" style={{ fontFamily: "var(--font-body)" }}>
                                {lead.position || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-[11px] font-normal ${statusColors[lead.status]}`}>
                                {statusLabels[lead.status]}
                              </span>
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
          </div>
        )}
      </main>
    </>
  );
}
