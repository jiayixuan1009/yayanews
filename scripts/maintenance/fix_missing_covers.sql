UPDATE articles 
SET cover_image = 'https://images.unsplash.com/photo-1628151015968-3a4429e9efee?q=80&w=1200&auto=format&fit=crop&sig=' || floor(random() * 100000)::text 
WHERE status = 'published' AND cover_image IS NULL;
