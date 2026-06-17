import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get("repo") || "";

  // Parse: support "owner/repo", "github.com/owner/repo", "https://github.com/owner/repo"
  let owner: string, repo: string;
  const urlMatch = input.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (urlMatch) {
    owner = urlMatch[1];
    repo = urlMatch[2];
  } else {
    const parts = input.replace(/^https?:\/\//, "").split("/").filter(Boolean);
    if (parts.length < 2) {
      return NextResponse.json({ error: "Format: owner/repo" }, { status: 400 });
    }
    owner = parts[parts.length - 2];
    repo = parts[parts.length - 1];
  }

  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = "Bearer " + process.env.GITHUB_TOKEN;
    }

    const gh = "https://api.github.com";
    const repoUrl = gh + "/repos/" + owner + "/" + repo;
    const repoRes = await fetch(repoUrl, { headers });
    if (repoRes.status === 404) {
      return NextResponse.json({ error: "Repo not found" }, { status: 404 });
    }
    if (repoRes.status === 403) {
      return NextResponse.json({ error: "API rate limit exceeded. Add GITHUB_TOKEN env var." }, { status: 429 });
    }
    const repoData = await repoRes.json();

    const commitsUrl = gh + "/repos/" + owner + "/" + repo + "/commits?per_page=30";
    const contribUrl = gh + "/repos/" + owner + "/" + repo + "/contributors?per_page=10";
    const depsUrl = gh + "/repos/" + owner + "/" + repo + "/contents/package.json";

    const [commitsRes, contribRes, depsRes] = await Promise.all([
      fetch(commitsUrl, { headers }).catch(() => null),
      fetch(contribUrl, { headers }).catch(() => null),
      fetch(depsUrl, { headers }).catch(() => null),
    ]);

    const commits = commitsRes && commitsRes.ok ? await commitsRes.json() : [];
    const contributors = contribRes && contribRes.ok ? await contribRes.json() : [];
    let deps: Record<string, string> = {};
    let devDeps: Record<string, string> = {};
    if (depsRes && depsRes.ok) {
      try {
        const depContent = await depsRes.json();
        const decoded = JSON.parse(
          Buffer.from(depContent.content, "base64").toString("utf-8")
        );
        deps = decoded.dependencies || {};
        devDeps = decoded.devDependencies || {};
      } catch {}
    }

    const commitDates = (Array.isArray(commits) ? commits : [])
      .filter((c: any) => c.commit && c.commit.committer && c.commit.committer.date)
      .map((c: any) => new Date(c.commit.committer.date).getTime());

    const now = Date.now();
    const lastCommitDate = commitDates.length > 0 ? Math.max(...commitDates) : null;
    const monthsSinceLastCommit = lastCommitDate ? Math.round((now - lastCommitDate) / 2592000000) : null;
    const commitCount30d = commitDates.filter((t: number) => now - t < 2592000000).length;

    const contribList = (Array.isArray(contributors) ? contributors : [])
      .slice(0, 5)
      .map((c: any) => ({
        login: c.login,
        avatar: c.avatar_url,
        contributions: c.contributions,
      }));

    const allDeps = { ...deps, ...devDeps };
    const totalDeps = Object.keys(allDeps).length;
    const outdatedDeps = Object.entries(allDeps)
      .filter(([, v]) => {
        const s = (v as string).replace(/^[\^~]/, "");
        return s.startsWith("0.") || s === "*";
      })
      .map(([k]) => k)
      .slice(0, 10);

    const issues = repoData.open_issues_count || 0;
    const findings: string[] = [];
    if (outdatedDeps.length > 0) findings.push(outdatedDeps.length + " dependencies appear outdated (major version < 1)");
    if (monthsSinceLastCommit !== null && monthsSinceLastCommit > 6) findings.push("Last commit was " + monthsSinceLastCommit + " months ago - possible abandonment");
    if (contribList.length === 1) findings.push("Single contributor - bus factor = 1");
    if (issues > 100) findings.push(issues + " open issues - maintenance debt");
    if (!repoData.license) findings.push("No license file - legal risk");

    let score = 50;
    if (monthsSinceLastCommit !== null && monthsSinceLastCommit <= 1) score += 15;
    else if (monthsSinceLastCommit !== null && monthsSinceLastCommit <= 3) score += 10;
    else if (monthsSinceLastCommit !== null && monthsSinceLastCommit > 12) score -= 20;
    else if (monthsSinceLastCommit !== null && monthsSinceLastCommit > 6) score -= 10;

    if (commitCount30d > 20) score += 10;
    else if (commitCount30d > 5) score += 5;

    if (contribList.length > 5) score += 10;
    else if (contribList.length > 1) score += 5;
    else if (contribList.length === 1) score -= 10;

    if (totalDeps > 0 && outdatedDeps.length === 0) score += 10;
    if (outdatedDeps.length > 5) score -= 10;

    if (repoData.stargazers_count > 1000) score += 5;

    const label = score >= 70 ? "Healthy" : score >= 40 ? "Needs Attention" : "At Risk";

    return NextResponse.json({
      repo: {
        name: repoData.name,
        fullName: repoData.full_name,
        owner: repoData.owner.login,
        avatar: repoData.owner.avatar_url,
        description: repoData.description,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: issues,
        license: repoData.license ? repoData.license.spdx_id : null,
        language: repoData.language,
        pushedAt: repoData.pushed_at,
        url: repoData.html_url,
      },
      health: {
        score: Math.max(0, Math.min(100, score)),
        label: label,
        monthsSinceLastCommit: monthsSinceLastCommit,
        commitCount30d: commitCount30d,
        contributorCount: contribList.length,
        contributorNames: contribList,
        totalDeps: totalDeps,
        outdatedDeps: outdatedDeps,
        securityFindings: findings,
        openIssuesCount: issues,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to analyze: " + (err.message || "unknown") }, { status: 500 });
  }
}
