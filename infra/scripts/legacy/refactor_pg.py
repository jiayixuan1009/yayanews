import os
import re

QUERY_FUNCS = [
    "getCategories", "getCategoriesOrdered", "getPublishedArticles", 
    "getArticleCountByType", "getArticleBySlug", "getArticleTags", 
    "getRelatedArticles", "getFlashMaxId", "getPublishedArticleMaxId", 
    "getFlashNews", "getTopics", "getTopicBySlug", "getArticleCount", 
    "getRecentArticlesForSitemap", "getNewsArticlesLast48h", "getAdjacentArticles", 
    "getPopularTags", "getTagBySlug", "getPublishedArticlesByTagSlug", 
    "getArticleCountByTagSlug", "getTagsForSitemap", "getGuides", 
    "getGuideBySlug", "searchArticles"
]

def refactor_tsx(base_dir):
    pattern = re.compile(r'(?<!await\s)\b(' + '|'.join(QUERY_FUNCS) + r')\(')
    for root, _, files in os.walk(base_dir):
        for f in files:
            if not f.endswith(('.tsx', '.ts')): continue
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # Skip queries.ts itself and db.ts
            if 'queries.ts' in path or 'db.ts' in path:
                continue
            
            # If the component isn't async, making it async (if it's a page or route)
            if 'export default function Page' in content:
                content = content.replace('export default function Page', 'export default async function Page')
            if 'export default function ' in content and 'async' not in content and any(func in content for func in QUERY_FUNCS):
                content = re.sub(r'export default function (\w+)', r'export default async function \1', content)
            
            # For route.ts
            if 'export function GET' in content:
                content = content.replace('export function GET', 'export async function GET')
            
            # Inject await
            new_content = pattern.sub(r'await \1(', content)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as file:
                    file.write(new_content)
                print(f"Refactored: {path}")

def refactor_queries_ts():
    path = os.path.join('src', 'lib', 'queries.ts')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Change imports
    content = content.replace("import { getDb } from './db';", "import { queryAll, queryGet } from './db';")
    
    # Change functions to async
    content = re.sub(r'export function (\w+)', r'export async function \1', content)
    
    # Remove const db = getDb();
    content = re.sub(r'\s*const db = getDb\(\);\n?', '\n', content)
    
    # Helper to convert ? to $1, $2, etc.
    def sql_repl(match):
        sql = match.group(1)
        count = 1
        while '?' in sql:
            sql = sql.replace('?', f'${count}', 1)
            count += 1
        return sql
    
    # Convert db.prepare(sql).all(...params) to queryAll(sql, [...params])
    # Case 1: .all() without params
    content = re.sub(r'getDb\(\)\.prepare\((`[^`]+`|\'[^\']+\')\)\.all\(\)', r'await queryAll(\1)', content)
    # Case 2: .all(...params)
    content = re.sub(r'getDb\(\)\.prepare\((`[^`]+`|\'[^\']+\')\)\.all\((.*?)\)', r'await queryAll(\1, [\2])', content)
    
    # Same for .get()
    content = re.sub(r'getDb\(\)\.prepare\((`[^`]+`|\'[^\']+\')\)\.get\(\)', r'await queryGet(\1)', content)
    content = re.sub(r'getDb\(\)\.prepare\((`[^`]+`|\'[^\']+\')\)\.get\((.*?)\)', r'await queryGet(\1, [\2])', content)

    # For multi-line sql strings inside standard db.prepare:
    content = re.sub(r'db\.prepare\((`[^`]+`)\)\.all\((.*?)\)', r'await queryAll(\1, [\2])', content)
    content = re.sub(r'db\.prepare\((`[^`]+`)\)\.get\((.*?)\)', r'await queryGet(\1, [\2])', content)
    content = re.sub(r'db\.prepare\((`[^`]+`)\)\.all\(\)', r'await queryAll(\1)', content)
    content = re.sub(r'db\.prepare\((`[^`]+`)\)\.get\(\)', r'await queryGet(\1)', content)

    content = re.sub(r'db\.prepare\((`[^`]+`|\'[^\']+\')\)\.run\((.*?)\)', r'await queryAll(\1, [\2])', content) # run to queryAll

    # Replace ? with $1 manually inside SQL strings
    # This regex is an approximation; we manually touch up complex ones.
    parts = content.split('`')
    for i in range(1, len(parts), 2):
        count = 1
        while '?' in parts[i]:
            parts[i] = parts[i].replace('?', f'${count}', 1)
            count += 1
    content = '`'.join(parts)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Refactored queries.ts!")

if __name__ == "__main__":
    refactor_tsx(os.path.join('src', 'app'))
    refactor_queries_ts()
