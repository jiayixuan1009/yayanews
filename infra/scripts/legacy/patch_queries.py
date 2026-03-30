import os
import re

def rewrite(file_path, replacements):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    orig = content
    for pattern, repl in replacements.items():
        content = re.sub(pattern, repl, content)
    if content != orig:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {file_path}")

base = r'd:\news\yayanews-production\src\app'

# 1. tag/[slug]
rewrite(os.path.join(base, r'[lang]\tag\[slug]\page.tsx'), {
    # page components are Server components but wait: 
    # const flashMini = getFlashNews(6);
    r'getFlashNews\(6\)': 'getFlashNews(params.lang, 6)'
})

# 2. news/[category]
rewrite(os.path.join(base, r'[lang]\news\[category]\page.tsx'), {
    r'getFlashNews\(6\)': 'getFlashNews(params.lang, 6)',
    r'getPublishedArticles\(36': 'getPublishedArticles(params.lang, 36'
})

# 3. news/page.tsx
rewrite(os.path.join(base, r'[lang]\news\page.tsx'), {
    r'getFlashNews\(6\)': 'getFlashNews(params.lang, 6)',
    r'getPublishedArticles\(pageSize': 'getPublishedArticles(params.lang, pageSize'
})

# 4. article/[slug]
rewrite(os.path.join(base, r'[lang]\article\[slug]\page.tsx'), {
    r'getPublishedArticles\(8': 'getPublishedArticles(params.lang, 8'
})

# 5. api/flash/route.ts
rewrite(os.path.join(base, r'api\flash\route.ts'), {
    r'const cat = searchParams\.get\(\'category\'\) \|\| undefined;': 
        "const cat = searchParams.get('category') || undefined;\n  const lang = searchParams.get('lang') || 'zh';",
    r'getFlashMaxId\(cat\)': 'getFlashMaxId(lang, cat)',
    r'getFlashNews\(limit, cat\)': "getFlashNews(lang, limit, cat)"
})

# 6. api/articles/route.ts
rewrite(os.path.join(base, r'api\articles\route.ts'), {
    r'const subcategory = searchParams\.get\(\'subcategory\'\) \|\| undefined;':
        "const subcategory = searchParams.get('subcategory') || undefined;\n  const lang = searchParams.get('lang') || 'zh';",
    r'getPublishedArticles\(limit, 0, category, subcategory\)':
        "getPublishedArticles(lang, limit, 0, category, subcategory)"
})

# 7. api/live/events/route.ts
rewrite(os.path.join(base, r'api\live\events\route.ts'), {
    r'export async function GET\(req: NextRequest\) {':
        "export async function GET(req: NextRequest) {\n  const lang = req.nextUrl.searchParams.get('lang') || 'zh';",
    r'getFlashMaxId\(\)': 'getFlashMaxId(lang)',
    r'getPublishedArticleMaxId\(\)': 'getPublishedArticleMaxId(lang)'
})

print("Done")
