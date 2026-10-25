import type { HubKey } from './industries';

/**
 * Customer stories. Only add an entry with the named customer's written permission and numbers they confirmed.
 * Nothing here is invented: while the list is empty, /customers and its sitemap entries do not exist.
 */

export type CaseStudy = {
  slug: string;
  /** Without the brand; the root layout appends " | NochBot". */
  title: string;
  description: string;
  customer: string;
  industry: string;
  hub: HubKey;
  /** ISO date. */
  published: string;
  challenge: string;
  solution: string;
  /** Results exactly as the customer confirmed them, with their wording. */
  results: string[];
  /** Quote and who said it, only if the customer approved it. */
  quote?: { text: string; by: string };
  related: string[];
};

export const CASE_STUDIES: CaseStudy[] = [];

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return CASE_STUDIES.find((c) => c.slug === slug);
}
