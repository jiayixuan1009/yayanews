import { permanentRedirect } from 'next/navigation';

export function GET() {
  permanentRedirect('/sitemap-news.xml');
}
