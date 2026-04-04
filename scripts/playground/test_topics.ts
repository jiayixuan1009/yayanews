import { getTopics } from './src/lib/queries';

async function main() {
  const topics = await getTopics(5);
  console.log(topics.map(t => ({ slug: t.slug, title: t.title, cover_image: t.cover_image })));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
