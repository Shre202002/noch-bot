import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Extracts hex colors from inline styles and CSS of a given URL
function extractColorsFromHtml(html: string): string[] {
  const hexRegex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  const rgbRegex = /rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/g;

  const found = new Set<string>();

  // Extract hex colors
  const hexMatches = html.match(hexRegex) || [];
  for (const hex of hexMatches) {
    const normalized = normalizeHex(hex);
    if (normalized && isVisualColor(normalized)) {
      found.add(normalized.toUpperCase());
    }
  }

  // Extract rgb and convert to hex
  let rgbMatch;
  while ((rgbMatch = rgbRegex.exec(html)) !== null) {
    const [, r, g, b] = rgbMatch;
    const hex = rgbToHex(parseInt(r), parseInt(g), parseInt(b));
    if (isVisualColor(hex)) {
      found.add(hex.toUpperCase());
    }
  }

  // Deduplicate and return top 8 most prominent
  return [...found].slice(0, 8);
}

function normalizeHex(hex: string): string | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return '#' + clean.split('').map(c => c + c).join('');
  }
  if (clean.length === 6) {
    return '#' + clean;
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Filter out near-white, near-black, and gray colors — keep brand colors
function isVisualColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  // Skip near-white
  if (r > 240 && g > 240 && b > 240) return false;
  // Skip near-black
  if (r < 20 && g < 20 && b < 20) return false;
  // Skip pure grays (r ≈ g ≈ b)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 30) return false;

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const response = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NochqTheme/1.0)' },
    });

    const html = response.data as string;

    // Also fetch any linked CSS stylesheets
    const $ = cheerio.load(html);
    const cssLinks: string[] = [];
    const origin = new URL(url).origin;

    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        try {
          cssLinks.push(new URL(href, origin).href);
        } catch {}
      }
    });

    let fullContent = html;

    // Fetch first 2 CSS files for more color data
    for (const cssUrl of cssLinks.slice(0, 2)) {
      try {
        const cssRes = await axios.get(cssUrl, { timeout: 5000 });
        fullContent += cssRes.data;
      } catch {}
    }

    const palette = extractColorsFromHtml(fullContent);

    // Fallback palette if extraction fails
    const finalPalette = palette.length >= 2 ? palette : ['#36f4a4', '#2563eb', '#8b5cf6'];

    return NextResponse.json({ palette: finalPalette });
  } catch (err: any) {
    console.error('[extract-theme] error:', err.message);
    // Return a default palette on error rather than failing
    return NextResponse.json({
      palette: ['#36f4a4', '#2563eb', '#8b5cf6', '#FF5701'],
    });
  }
}