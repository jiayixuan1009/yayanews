-- Clear existing topic associations
UPDATE articles SET topic_id = NULL;

-- Keep sequence or just clear topics table
DELETE FROM topics;
-- Reset sequence if needed (optional)
ALTER SEQUENCE topics_id_seq RESTART WITH 1;

-- Insert 26 Entities
INSERT INTO topics (slug, title, name_zh, name_en, cover_image) VALUES
('nvidia', '英伟达', '英伟达', 'NVIDIA', '/images/topics/nvidia.png'),
('apple', '苹果', '苹果', 'Apple', '/images/topics/apple.png'),
('tesla', '特斯拉', '特斯拉', 'Tesla', '/images/topics/tesla.png'),
('microsoft', '微软', '微软', 'Microsoft', '/images/topics/microsoft-openai.png'),
('amd', 'AMD', 'AMD', 'AMD', NULL),
('google', '谷歌', '谷歌', 'Google', NULL),
('meta', 'Meta', 'Meta', 'Meta', NULL),
('intc', '英特尔', '英特尔', 'Intel', NULL),
('smci', '超微电脑', '超微电脑', 'Super Micro', NULL),
('coinbase', 'Coinbase', 'Coinbase', 'Coinbase', NULL),

('openai', 'OpenAI', 'OpenAI', 'OpenAI', NULL),
('anthropic', 'Anthropic', 'Anthropic', 'Anthropic', NULL),
('xai', 'xAI', 'xAI', 'xAI', NULL),
('spacex', 'SpaceX', 'SpaceX', 'SpaceX', NULL),
('tiktok', '字节与TikTok', '字节与TikTok', 'TikTok', NULL),
('telegram', 'Telegram', 'Telegram', 'Telegram', NULL),

('chatgpt', 'ChatGPT', 'ChatGPT', 'ChatGPT', NULL),
('sora', 'Sora', 'Sora', 'Sora', NULL),
('llm', '大模型', '大模型', 'LLMs', '/images/topics/artificial-intelligence-boom.png'),
('defi', 'DeFi', 'DeFi', 'DeFi', NULL),
('layer2', 'Layer2', 'Layer2', 'Layer 2', NULL),

('fed', '美联储', '美联储', 'Fed', '/images/topics/fed-interest-rates.png'),
('cpi', '非农与CPI', '非农与CPI', 'CPI & Non-Farm', NULL),
('earnings', '财报', '财报', 'Earnings', '/images/topics/earnings-season.png'),
('btc', '比特币', '比特币', 'Bitcoin', '/images/topics/bitcoin-etf.png'),
('eth', '以太坊', '以太坊', 'Ethereum', NULL);


-- STEP 2. Automated Tagging by executing sequential UPDATEs on articles.
-- First matched rule wins (since we check for topic_id IS NULL)

-- 1. NVDA
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'nvidia') 
WHERE topic_id IS NULL AND (tickers ILIKE '%NVDA%' OR title ILIKE '%英伟达%' OR title ILIKE '%Nvidia%');

-- 2. AAPL
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'apple') 
WHERE topic_id IS NULL AND (tickers ILIKE '%AAPL%' OR title ILIKE '%苹果%' OR title ILIKE '%Apple%');

-- 3. TSLA
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'tesla') 
WHERE topic_id IS NULL AND (tickers ILIKE '%TSLA%' OR title ILIKE '%特斯拉%' OR title ILIKE '%Tesla%');

-- 4. MSFT
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'microsoft') 
WHERE topic_id IS NULL AND (tickers ILIKE '%MSFT%' OR title ILIKE '%微软%' OR title ILIKE '%Microsoft%');

-- 5. AMD
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'amd') 
WHERE topic_id IS NULL AND (tickers ILIKE '%AMD%' OR title ILIKE '%AMD%');

-- 6. GOOGL
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'google') 
WHERE topic_id IS NULL AND (tickers ILIKE '%GOOGL%' OR tickers ILIKE '%GOOG%' OR title ILIKE '%谷歌%' OR title ILIKE '%Google%');

-- 7. META
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'meta') 
WHERE topic_id IS NULL AND (tickers ILIKE '%META%' OR title ILIKE '%Meta%');

-- 8. INTC
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'intc') 
WHERE topic_id IS NULL AND (tickers ILIKE '%INTC%' OR title ILIKE '%英特尔%' OR title ILIKE '%Intel%');

-- 9. SMCI
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'smci') 
WHERE topic_id IS NULL AND (tickers ILIKE '%SMCI%' OR title ILIKE '%超微电脑%');

-- 10. COINBASE
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'coinbase') 
WHERE topic_id IS NULL AND (tickers ILIKE '%COIN%' OR title ILIKE '%Coinbase%');

-- 11. OpenAI
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'openai') 
WHERE topic_id IS NULL AND (title ILIKE '%OpenAI%' OR title ILIKE '%奥特曼%');

-- 12. Anthropic
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'anthropic') 
WHERE topic_id IS NULL AND (title ILIKE '%Anthropic%');

-- 13. xAI
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'xai') 
WHERE topic_id IS NULL AND (title ILIKE '%xAI%');

-- 14. SpaceX
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'spacex') 
WHERE topic_id IS NULL AND (title ILIKE '%SpaceX%');

-- 15. TikTok
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'tiktok') 
WHERE topic_id IS NULL AND (title ILIKE '%TikTok%' OR title ILIKE '%字节跳动%');

-- 16. Telegram
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'telegram') 
WHERE topic_id IS NULL AND (title ILIKE '%Telegram%' OR title ILIKE '%Toncoin%');

-- 17. ChatGPT
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'chatgpt') 
WHERE topic_id IS NULL AND (title ILIKE '%ChatGPT%');

-- 18. Sora
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'sora') 
WHERE topic_id IS NULL AND (title ILIKE '%Sora%');

-- 19. LLMs
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'llm') 
WHERE topic_id IS NULL AND (title ILIKE '%大模型%' OR title ILIKE '%LLM%');

-- 20. DeFi
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'defi') 
WHERE topic_id IS NULL AND (title ILIKE '%DeFi%' OR title ILIKE '%去中心化金融%');

-- 21. Layer2
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'layer2') 
WHERE topic_id IS NULL AND (title ILIKE '%Layer2%' OR title ILIKE '%L2%' OR title ILIKE '%二层网络%');

-- 22. Fed
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'fed') 
WHERE topic_id IS NULL AND (title ILIKE '%美联储%' OR title ILIKE '%加息%' OR title ILIKE '%降息%' OR title ILIKE '%鲍威尔%');

-- 23. CPI
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'cpi') 
WHERE topic_id IS NULL AND (title ILIKE '%CPI%' OR title ILIKE '%非农%' OR title ILIKE '%通胀%');

-- 24. Earnings
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'earnings') 
WHERE topic_id IS NULL AND (title ILIKE '%财报%' OR title ILIKE '%业绩%');

-- 25. Bitcoin
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'btc') 
WHERE topic_id IS NULL AND (tickers ILIKE '%BTC%' OR title ILIKE '%比特币%' OR title ILIKE '%Bitcoin%');

-- 26. Ethereum
UPDATE articles 
SET topic_id = (SELECT id FROM topics WHERE slug = 'eth') 
WHERE topic_id IS NULL AND (tickers ILIKE '%ETH%' OR title ILIKE '%以太坊%' OR title ILIKE '%Ethereum%');
