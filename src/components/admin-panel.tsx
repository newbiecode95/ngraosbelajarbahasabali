"use client";
import { useEffect, useState } from "react";
import { Check, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "@/lib/client-api";
import type { CorpusEntry, Locale } from "@/lib/types";
import { Spinner } from "./ui";
type Entry = CorpusEntry & { enabled: boolean; embedded: boolean };
type Report = {
  id: string;
  message: string;
  resolved: boolean;
  created_at: string;
};
type Usage = {
  stage: string;
  model: string;
  provider: string;
  requests: number;
  avg_latency_ms: number;
  cost_usd: number;
};
type Overview = {
  totals: Record<string, number>;
  reports: Report[];
  usage: Usage[];
  models: Record<string, string>;
};
export function AdminPanel({ locale }: { locale: Locale }) {
  const [overview, setOverview] = useState<Overview | null>(null),
    [entries, setEntries] = useState<Entry[]>([]),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const t = (id: string, en: string) => (locale === "id" ? id : en);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const [o, c] = await Promise.all([
        api<Overview>("/api/admin"),
        api<{ entries: Entry[] }>("/api/admin/content"),
      ]);
      setOverview(o);
      setEntries(c.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function patch(endpoint: string, body: object) {
    setBusy(true);
    try {
      await api(endpoint, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-panel">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <ShieldCheck size={14} />
            {t("PANEL PENGELOLA", "ADMINISTRATION")}
          </div>
          <h1>{t("Desa di balik layar.", "Behind the village.")}</h1>
          <p>
            {t(
              "Materi, laporan pemain, dan penggunaan layanan.",
              "Learning material, player reports, and service usage.",
            )}
          </p>
        </div>
        <button className="btn subtle" onClick={load} disabled={busy}>
          {busy ? <Spinner /> : <RefreshCw size={16} />}Refresh
        </button>
      </section>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {overview ? (
        <>
          <div className="admin-totals">
            {Object.entries(overview.totals).map(([key, value]) => (
              <div className="settings-card" key={key}>
                <strong>{value}</strong>
                <span>{key.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
          <section className="settings-card">
            <h2>{t("Laporan pemain", "Player reports")}</h2>
            {overview.reports.length ? (
              overview.reports.map((r) => (
                <div className="admin-report" key={r.id}>
                  <div>
                    <p>{r.message}</p>
                    <small>
                      {new Date(r.created_at).toLocaleString(
                        locale === "id" ? "id-ID" : "en-GB",
                      )}
                    </small>
                  </div>
                  <button
                    disabled={busy}
                    className="btn subtle"
                    onClick={() =>
                      patch("/api/admin/reports", {
                        id: r.id,
                        resolved: !r.resolved,
                      })
                    }
                  >
                    {r.resolved ? <Check size={15} /> : null}
                    {r.resolved
                      ? t("Ditangani · buka lagi", "Resolved · reopen")
                      : t("Tandai ditangani", "Mark resolved")}
                  </button>
                </div>
              ))
            ) : (
              <p className="note">
                {t("Belum ada laporan.", "No reports yet.")}
              </p>
            )}
          </section>
          <section className="settings-card">
            <h2>{t("Penggunaan 30 hari", "30-day usage")}</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "Task",
                      "Model / provider",
                      t("Permintaan", "Requests"),
                      t("Latensi rata-rata", "Average latency"),
                      "USD",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.usage.map((u, i) => (
                    <tr key={i}>
                      <td>{u.stage}</td>
                      <td>
                        {u.model}
                        <small>{u.provider || "—"}</small>
                      </td>
                      <td>{u.requests}</td>
                      <td>{(u.avg_latency_ms / 1000).toFixed(2)}s</td>
                      <td>{Number(u.cost_usd).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">
              {t(
                "Biaya yang dilaporkan provider. Biaya audio yang tidak dikirim provider belum tercakup; cocokkan dengan dashboard OpenRouter.",
                "Provider-reported costs. Unreported audio costs are excluded; reconcile with the OpenRouter dashboard.",
              )}
            </p>
          </section>
          <section className="settings-card">
            <h2>{t("Model aktif", "Active models")}</h2>
            <div className="model-list">
              {Object.entries(overview.models).map(([task, model]) => (
                <div key={task}>
                  <strong>{task}</strong>
                  <code>{String(model)}</code>
                </div>
              ))}
            </div>
            <p className="note">
              {t(
                "Ubah model melalui konfigurasi server dan jalankan pemeriksaan kemampuan sebelum deployment.",
                "Change models in the server configuration and run capability checks before deploying.",
              )}
            </p>
          </section>
        </>
      ) : null}
      <section className="settings-card">
        <div className="source-toolbar">
          <h2>{t("Kelola materi", "Manage material")}</h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              "Cari kata atau sumber…",
              "Search words or sources…",
            )}
            aria-label={t("Cari materi admin", "Search admin material")}
          />
        </div>
        <div className="admin-content-list">
          {entries
            .filter((e) =>
              `${e.bali} ${e.indonesia} ${e.sourceTitle}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((e) => (
              <article key={e.id}>
                <div>
                  <strong>{e.bali}</strong>
                  <p>{locale === "id" ? e.indonesia : e.english}</p>
                  <a href={e.sourceUrl} target="_blank" rel="noreferrer">
                    {e.sourceTitle}
                    <ExternalLink size={12} />
                  </a>
                  <small>
                    {e.status} · {e.embedded ? "vector ✓" : "no vector"} ·{" "}
                    {e.license}
                  </small>
                </div>
                <button
                  className={`btn ${e.enabled ? "subtle" : "primary"}`}
                  disabled={busy || (!e.enabled && e.status === "draft")}
                  onClick={() =>
                    patch("/api/admin/content", {
                      id: e.id,
                      enabled: !e.enabled,
                    })
                  }
                >
                  {e.enabled
                    ? t("Tahan materi", "Disable entry")
                    : e.status === "draft"
                      ? t("Menunggu pemeriksaan", "Awaiting review")
                      : t("Aktifkan", "Enable entry")}
                </button>
              </article>
            ))}
        </div>
      </section>
    </div>
  );
}
