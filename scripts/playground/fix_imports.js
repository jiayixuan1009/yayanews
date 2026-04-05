const fs = require('fs');
const glob = require('glob');

const files = [
  'apps/web/src/lib/queries.ts',
  'apps/admin/scripts/topic-nominate.ts',
  'apps/admin/src/lib/admin-queries.ts',
  'apps/admin/src/app/api/topics/[id]/route.ts',
  'apps/admin/src/app/api/topics/route.ts',
  'apps/admin/src/app/api/topics/[id]/featured/route.ts',
  'apps/admin/src/app/api/topics/generate/route.ts',
  'apps/admin/src/app/api/articles/[id]/route.ts'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace import
    // Note: We might have "import { queryAll, queryGet } from '@yayanews/database';"
    content = content.replace(/import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]@yayanews\/database['"];?/g, "import * as db from '@yayanews/database';");
    
    // Check if db is defined in scope
    if (content.includes("import * as db from '@yayanews/database'")) {
       // Replace usages. Since queryAll, queryGet, queryRun are distinct names, we can just replace them globally when they are called as functions.
       // E.g., `queryAll<` or `queryAll(`
       content = content.replace(/\bqueryAll\b/g, 'db.queryAll');
       content = content.replace(/\bqueryGet\b/g, 'db.queryGet');
       content = content.replace(/\bqueryRun\b/g, 'db.queryRun');
       content = content.replace(/db\.db\./g, 'db.'); // just in case
    }
    
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
