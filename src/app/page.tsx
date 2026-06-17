"use client";

import { useState, FormEvent } from "react";

type Contributor = { login: string; avatar: string; contributions: number };
type RepoData = {
  name: string; fullName: string; owner: string; avatar: string;
  description: string; stars: number; forks: number; openIssues: number;
  license: string | null; language: string; topics: string[];
  createdAt: string; pushedAt: string; url: string;
};
type HealthData = {
  score: number; label: string;
  monthsSinceLastCommit: number | null; commitCount30d: number;
  contributorCount: number; contributorNames: Contributor[];
  totalDeps: number; outdatedDeps: string[];
  securityFindings: string[]; openIssuesCount: number;
};
type Data = { repo: RepoData; health: HealthData };

function scoreColor(score: number) {
  if (score >= 70) return "text-green-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

export default function Home() {
  const [input, setInput] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roast, setRoast] = useState("");

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true); setError(""); setData(null); setRoast("");
    try {
      const q = encodeURIComponent(input.trim());
      const res = await fetch("/api/github?repo=" + q);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Error " + res.status);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function generateRoast() {
    if (!data) return;
    const roasts = [
      "Repo: " + data.repo.fullName + ". " + data.repo.stars + " stars, " + data.repo.openIssues + " open issues. " + (data.repo.stars > 0 ? (data.repo.openIssues / data.repo.stars).toFixed(2) : "infinite") + " issues per star.",
      "Last commit: " + (data.health.monthsSinceLastCommit !== null ? data.health.monthsSinceLastCommit + " months ago" : "unknown") + ". " + (data.health.monthsSinceLastCommit !== null && data.health.monthsSinceLastCommit > 12 ? "At this point it is not abandonware, it is archaeology." : data.health.monthsSinceLastCommit !== null && data.health.monthsSinceLastCommit > 6 ? "Still warm. Barely." : "Actively maintained. Rare."),
      data.health.outdatedDeps.length + " outdated dependencies. " + data.health.outdatedDeps.slice(0, 5).join(", ") + (data.health.outdatedDeps.length > 5 ? " and " + (data.health.outdatedDeps.length - 5) + " more" : "") + ". Your npm audit would like a word.",
      "Bus factor: " + data.health.contributorCount + ". " + (data.health.contributorCount === 1 ? "If this person gets hit by a bus, the project dies. Literally." : data.health.contributorCount < 5 ? "Cozy team. Hope nobody quits." : "Respectable. The bus can roam freely."),
      "License: " + (data.repo.license || "NONE") + ". " + (data.repo.license ? "At least you are legally safe." : "Lawyers love this one weird trick."),
      "Health score: " + data.health.score + "/100 - " + data.health.label + ". " + (data.health.score >= 70 ? "Actually solid. I am impressed." : data.health.score >= 40 ? "Room for improvement. Lots of it." : "I have seen better. I have seen worse. This is worse."),
      data.health.securityFindings.length + " security flags. " + data.health.securityFindings.slice(0, 2).join("; ") + ". You might want to look into that.",
    ];
    setRoast(roasts[Math.floor(Math.random() * roasts.length)]);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2 tracking-tight">GitHub Repo Analyzer</h1>
        <p className="text-zinc-500 mb-8 text-sm">Enter a repo (owner/repo). Get a health score. Actually learn something.</p>

        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="owner/repo (e.g. vercel/next.js)"
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-4 py-2.5 text-sm outline-none focus:border-zinc-600 transition-colors"
          />
          <button type="submit" disabled={loading}
            className="bg-zinc-100 text-zinc-900 px-5 py-2.5 rounded text-sm font-medium hover:bg-zinc-300 disabled:opacity-50 transition-all">
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </form>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {data && (
          <div className="space-y-5">
            <div className="flex items-start gap-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <img src={data.repo.avatar} alt="" className="w-14 h-14 rounded-full" />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold">{data.repo.fullName}</h2>
                {data.repo.description && <p className="text-sm text-zinc-400 mt-0.5">{data.repo.description}</p>}
                <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                  <span>Star {data.repo.stars.toLocaleString()}</span>
                  <span>Fork {data.repo.forks.toLocaleString()}</span>
                  <span>Issue {data.repo.openIssues}</span>
                  <span>{data.repo.language || "?"}</span>
                  {data.repo.license && <span>{data.repo.license}</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Health Score", value: data.health.score + "/100", color: scoreColor(data.health.score) },
                { label: "Last Commit", value: data.health.monthsSinceLastCommit !== null ? data.health.monthsSinceLastCommit + "mo ago" : "N/A" },
                { label: "Commits (30d)", value: data.health.commitCount30d },
                { label: "Contributors", value: data.health.contributorCount },
              ].map(s => (
                <div key={s.label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
                  <div className={"text-2xl font-bold " + (s.color || "text-zinc-100")}>{s.value}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Security & Maintenance</h3>
                <button onClick={generateRoast}
                  className="text-xs bg-red-900/40 text-red-300 px-3 py-1.5 rounded-md hover:bg-red-800/50 transition-colors">
                  Roast
                </button>
              </div>
              {roast && (
                <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 mb-3 text-sm text-zinc-300 italic">
                  {roast}
                </div>
              )}
              {data.health.securityFindings.length > 0 ? (
                <ul className="space-y-1">
                  {data.health.securityFindings.map((f, i) => (
                    <li key={i} className="text-sm text-red-400/80 flex items-start gap-2">
                      <span className="mt-0.5 shrink-0">*</span>
                      {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-green-400/80">No security flags detected. Clean bill of health.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.health.totalDeps > 0 && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">Dependencies</h3>
                  <p className="text-sm text-zinc-400 mb-1">{data.health.totalDeps} total</p>
                  {data.health.outdatedDeps.length > 0 && (
                    <div>
                      <p className="text-xs text-red-400/80 mb-1">{data.health.outdatedDeps.length} potentially outdated:</p>
                      <div className="text-xs text-zinc-500 max-h-24 overflow-y-auto">
                        {data.health.outdatedDeps.slice(0, 10).join(", ")}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {data.health.contributorNames.length > 0 && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">Top Contributors</h3>
                  <div className="space-y-1.5">
                    {data.health.contributorNames.map((c) => (
                      <div key={c.login} className="flex items-center gap-2 text-sm">
                        <img src={c.avatar} alt="" className="w-5 h-5 rounded-full" />
                        <span className="text-zinc-300">{c.login}</span>
                        <span className="text-zinc-600 ml-auto">{c.contributions} commits</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <a href={data.repo.url} target="_blank" rel="noopener noreferrer"
              className="block text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              View on GitHub
            </a>
          </div>
        )}
        <footer className="mt-12 text-center text-zinc-700 text-[11px]">
          GitHub Repo Analyzer
        </footer>
      </div>
    </main>
  );
}
