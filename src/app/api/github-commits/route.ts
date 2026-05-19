import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const token = process.env.GITHUB_TOKEN;
    // Fetching the last 10 commits from the NochBot repository
    const response = await fetch(
      'https://api.github.com/repos/Shre202002/noch-bot/commits?per_page=10',
      {
        headers: token ? { Authorization: `token ${token}` } : {},
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const data = await response.json();
    const commits = data.map((item: any) => ({
      sha: item.sha.substring(0, 7),
      message: item.commit.message,
      date: item.commit.author.date,
      url: item.html_url,
    }));

    return NextResponse.json(commits);
  } catch (error: any) {
    console.error('GitHub fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch commits' }, { status: 500 });
  }
}