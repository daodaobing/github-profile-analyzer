import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = {};
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const [userRes, reposRes, eventsRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers }),
      fetch(`https://api.github.com/users/${username}/events?per_page=30`, { headers }),
    ]);

    if (userRes.status === 404) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (userRes.status === 403) {
      return NextResponse.json({ error: "Rate limited. Try again later." }, { status: 429 });
    }

    const user = await userRes.json();
    const repos = await reposRes.json();
    const events = await eventsRes.json();

    const langMap: Record<string, number> = {};
    (repos as any[]).forEach((r: any) => {
      if (r.language) {
        langMap[r.language] = (langMap[r.language] || 0) + 1;
      }
    });

    const sorted = Object.entries(langMap)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const totalStars = (repos as any[]).reduce((s: number, r: any) => s + r.stargazers_count, 0);
    const totalForks = (repos as any[]).reduce((s: number, r: any) => s + r.forks_count, 0);

    const recentCommits = (events as any[]).filter((e: any) => e.type === "PushEvent")
      .reduce((s: number, e: any) => s + (e.payload?.size || 0), 0);

    const repoList = (repos as any[])
      .sort((a: any, b: any) => b.stargazers_count - a.stargazers_count)
      .slice(0, 20)
      .map((r: any) => ({
        name: r.name,
        stars: r.stargazers_count,
        forks: r.forks_count,
        language: r.language,
        description: r.description,
        updated: r.updated_at,
      }));

    return NextResponse.json({
      profile: {
        login: user.login,
        name: user.name,
        avatar: user.avatar_url,
        bio: user.bio,
        followers: user.followers,
        following: user.following,
        publicRepos: user.public_repos,
        createdAt: user.created_at,
      },
      stats: {
        totalStars,
        totalForks,
        recentCommits,
        topLanguages: sorted,
      },
      repos: repoList,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
