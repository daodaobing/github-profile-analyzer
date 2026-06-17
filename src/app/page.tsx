"use client";

import { useState, FormEvent } from "react";

type Profile = {
  login: string; name: string; avatar: string; bio: string;
  followers: number; following: number; publicRepos: number;
};
type LangItem = { name: string; count: number };
type RepoItem = { name: string; stars: number; forks: number; language: string | null; description: string | null };
type Data = {
  profile: Profile;
  stats: { totalStars: number; totalForks: number; recentCommits: number; topLanguages: LangItem[] };
  repos: RepoItem[];
};

const ROASTS = [
  (d: Data) => `You have ${d.profile.publicRepos} public repos, but only ${d.repos.filter(r => r.description).length} have descriptions. Documentation is a personality trait, apparently.`,
  (d: Data) => `Your most-starred repo has ${Math.max(...d.repos.map(r => r.stars), 0)} stars. You're 10,000 away from being famous on GitHub. Keep grinding.`,
  (d: Data) => `${d.stats.totalStars} total stars across ${d.profile.publicRepos} repos. That's ${d.profile.publicRepos > 0 ? (d.stats.totalStars / d.profile.publicRepos).toFixed(1) : 0} stars per repo. The math is... not mathing.`,
  (d: Data) => `You've made ${d.stats.recentCommits} commits recently. ${d.stats.recentCommits < 10 ? "Are you on vacation? It's been a year." : d.stats.recentCommits < 50 ? "Decent pace. For a part-timer." : "OK, you're actually coding. Respect."}`,
  (d: Data) => `Top language: ${d.stats.topLanguages[0]?.name || "nothing"}. ${d.stats.topLanguages[0]?.name === "JavaScript" ? "Groundbreaking. Nobody has ever used JavaScript before." : d.stats.topLanguages[0]?.name === "Python" ? "Machine learning engineer? Or just run pip install and pray?" : "Interesting choice."}`,
  (d: Data) => `${d.profile.followers} followers, ${d.profile.following} following. You follow ${d.profile.following > d.profile.followers ? `${(d.profile.following / Math.max(d.profile.followers, 1)).toFixed(1)}x more people than follow you. Classic.` : "At least you're popular. Or you bought followers. We don't judge."}`,
  (d: Data) => `Bio: ${d.profile.bio || "NONE"}. ${d.profile.bio ? "At least you have one. Half points." : "A blank bio tells me everything I need to know."}`,
];

export default function Home() {
  const [username, setUsername] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roast, setRoast] = useState("");

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true); setError(""); setData(null); setRoast("");
    try {
      const res = await fetch(`/api/github?username=${encodeURIComponent(username.trim())}`);
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || `Error ${res.status}`);
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
    const fn = ROASTS[Math.floor(Math.random() * ROASTS.length)];
    setRoast(fn(data));
  }

  const colors = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899"];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2 tracking-tight">GitHub Analyzer</h1>
        <p className="text-zinc-500 mb-8 text-sm">Enter a username. Get roasted. Actually learn something.</p>

        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Enter GitHub username..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-4 py-2.5 text-sm outline-none focus:border-zinc-600 transition-colors"
          />
          <button type="submit" disabled={loading}
            className="bg-zinc-100 text-zinc-900 px-5 py-2.5 rounded text-sm font-medium hover:bg-zinc-300 disabled:opacity-50 transition-all">
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {data && (
          <div className="space-y-6">
            <div className="flex items-start gap-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <img src={data.profile.avatar} alt="" className="w-16 h-16 rounded-full" />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold">{data.profile.name || data.profile.login}</h2>
                <p className="text-xs text-zinc-500 mb-1">@{data.profile.login}</p>
                {data.profile.bio && <p className="text-sm text-zinc-400">{data.profile.bio}</p>}
                <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                  <span>{data.profile.followers} followers</span>
                  <span>{data.profile.following} following</span>
                  <span>{data.profile.publicRepos} repos</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[{ label: "Total Stars", value: data.stats.totalStars },
                { label: "Total Forks", value: data.stats.totalForks },
                { label: "Recent Commits", value: data.stats.recentCommits },
              ].map(s => (
                <div key={s.label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-zinc-500">{s.label}</div>
                </div>
              ))}
            </div>

            {data.stats.topLanguages.length > 0 && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-medium mb-3 text-zinc-400 uppercase tracking-wider">Languages</h3>
                <div className="flex h-3 rounded-full overflow-hidden">
                  {data.stats.topLanguages.map((l, i) => (
                    <div key={l.name} style={{ width: `${(l.count / data.stats.topLanguages.reduce((s, x) => s + x.count, 0)) * 100}%`, backgroundColor: colors[i % colors.length] }} title={`${l.name}: ${l.count} repos`} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-zinc-500">
                  {data.stats.topLanguages.map((l, i) => (
                    <span key={l.name} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: colors[i % colors.length] }} />
                      {l.name} ({l.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Repos</h3>
                <button onClick={generateRoast}
                  className="text-xs bg-red-900/40 text-red-300 px-3 py-1.5 rounded-md hover:bg-red-800/50 transition-colors">
                  Roast me
                </button>
              </div>
              {roast && (
                <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 mb-3 text-sm text-zinc-300 italic">
                  {roast}
                </div>
              )}
              <div className="space-y-1">
                {data.repos.slice(0, 10).map((r) => (
                  <div key={r.name} className="flex items-center justify-between py-1.5 border-b border-zinc-800/50 last:border-0">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm">{r.name}</span>
                      {r.language && <span className="text-xs text-zinc-600 ml-2">{r.language}</span>}
                    </div>
                    <div className="flex gap-3 text-xs text-zinc-600 shrink-0">
                      <span>★ {r.stars}</span>
                      <span>⑂ {r.forks}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
