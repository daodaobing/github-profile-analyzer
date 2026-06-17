import { NextResponse } from "next/server";

const GH = "https://api.github.com";

function makeHeaders() {
  const h: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (process.env.GITHUB_TOKEN) h["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get("repo") || "";
  const parts = input.split("/").filter(Boolean);
  if (parts.length < 2) {
    return NextResponse.json({ error: "Format: owner/repo" }, { status: 400 });
  }
  const [owner, repo] = parts;

  try {
    const headers = makeHeaders();

    const [repoRes, depsRes, commitsRes, contributorsRes, issuesRes] = await Promise.all([
      fetch(`${GH}/repos/${owner}/${repo}`, { headers }),
      fetch(`${GH}/repos/${owner}/${repo}/contents/package.json`, { headers }).catch(() => null),
      fetch(`${GH}/repos/${owner}/${repo}/commits?per_page=30`, { headers }),
      fetch(`${GH}/repos/${owner}/${repo}/contributors?per_page=10`, { headers }),
      fetch(`${GH}/repos/${owner}/${repo}/issues?state=open&per_page=5&sort=updated`, { headers }),
    ]);

    if (repoRes.status === 404) return NextResponse.json({ error: "Repo not found" }, { status: 404 });
    if (repoRes.status === 403) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

    const repoData = await repoRes.json();
    const commits = await commitsRes.json();
    const contributors = Array.isArray(await contributorsRes.json()) ? await contributorsRes.json() : [];
    const issues = Array.isArray(await issuesRes.json()) ? await issuesRes.json() : [];

    let deps: Record<string, string> = {};
    let devDeps: Record<string, string> = {};
    if (depsRes && depsRes.ok) {
      try {
        const depContent = await depsRes.json();
        const decoded = JSON.parse(Buffer.from(depContent.content, "base64").toString());
        deps = decoded.dependencies || {};
        devDeps = decoded.devDependencies || {};
      } catch {}
    }

    const commitTimes = commits
      .filter((c: any) => c.commit?.committer?.date)
      .map((c: any) => new Date(c.commit.committer.date).getTime());

    const now = Date.now();
    const avgDaysSinceLastCommit =
      commitTimes.length > 0
        ? (now - Math.max(...commitTimes)) / 86400000
        : null;

    const monthsSinceLastCommit =
      avgDaysSinceLastCommit !== null ? Math.round(avgDaysSinceLastCommit / 30) : null;

    const commitCount30d = commitTimes.filter((t: number) => now - t < 30 * 86400000).length;

    const contributorCount = contributors.length;
    const contributorNames = contributors.slice(0, 5).map((c: any) => ({ login: c.login, avatar: c.avatar_url, contributions: c.contributions }));

    const allDeps = { ...deps, ...devDeps };
    const totalDeps = Object.keys(allDeps).length;
    const outdatedDeps = Object.entries(allDeps)
      .filter(([, v]) => {
        const s = (v as string).replace(/^[\^~]/, "");
        return s.startsWith("0.") || s.startsWith("1.") || s === "*";
      })
      .map(([k]) => k);

    const securityFindings: string[] = [];
    if (outdatedDeps.length > 0) {
      securityFindings.push(`${outdatedDeps.length} dependencies appear outdated (major version < 2)`);
    }
    if (monthsSinceLastCommit !== null && monthsSinceLastCommit > 6) {
      securityFindings.push(`Last commit was ${monthsSinceLastCommit} months ago — possible abandonment`);
    }
    if (contributorCount === 1) {
      securityFindings.push("Single contributor — bus factor = 1");
    }
    if (repoData.open_issues_count > 50) {
      securityFindings.push(`${repoData.open_issues_count} open issues — maintenance debt`);
    }
    if (!repoData.license) {
      securityFindings.push("No license file — legal risk");
    }
    if (!repoData.description) {
      securityFindings.push("No description — trustworthiness signal");
    }

    const totalScore = Math.max(0, Math.min(100, Math.round(
      25
      - (monthsSinceLastCommit !== null && monthsSinceLastCommit > 3 ? 10 : 0)
      - (outdatedDeps.length > 3 ? 10 : outdatedDeps.length > 0 ? 5 : 0)
      - (contributorCount === 1 ? 10 : 0)
      - (repoData.open_issues_count > 50 ? 5 : 0)
      - (!repoData.license ? 5 : 0)
      - (!repoData.description ? 5 : 0)
      + (commitCount30d > 10 ? 10 : commitCount30d > 3 ? 5 : 0)
      + (contributorCount > 5 ? 10 : contributorCount > 1 ? 5 : 0)
      + (totalDeps > 0 ? 5 : 0)
      + (repoData.stargazers_count > 100 ? 5 : 0)
    )));

    return NextResponse.json({
      repo: {
        name: repoData.name,
        fullName: repoData.full_name,
        owner: repoData.owner?.login,
        avatar: repoData.owner?.avatar_url,
        description: repoData.description,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        license: repoData.license?.spdx_id || null,
        language: repoData.language,
        topics: repoData.topics || [],
        createdAt: repoData.created_at,
        updatedAt: repoData.updated_at,
        pushedAt: repoData.pushed_at,
        url: repoData.html_url,
      },
      health: {
        score: totalScore,
        label: totalScore >= 70 ? "Healthy" : totalScore >= 40 ? "Needs Attention" : "At Risk",
        monthsSinceLastCommit,
        commitCount30d,
        contributorCount,
        contributorNames,
        totalDeps,
        outdatedDeps,
        securityFindings,
        openIssuesCount: repoData.open_issues_count,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to analyze" }, { status: 500 });
  }
}
