const fs = require('fs');
const path = require('path');

const root = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\10992c74-c0d2-4566-af5b-2d1fb8c9f334';
const projectRoot = 'd:\\news\\yayanews-production';

// 1. Delete original redirect page
if (fs.existsSync(path.join(projectRoot, 'apps/admin/src/app/page.tsx'))) {
  fs.unlinkSync(path.join(projectRoot, 'apps/admin/src/app/page.tsx'));
}

// 2. Delete original layout from admin
if (fs.existsSync(path.join(projectRoot, 'apps/admin/src/app/admin/layout.tsx'))) {
  fs.unlinkSync(path.join(projectRoot, 'apps/admin/src/app/admin/layout.tsx'));
}

// 3. Move components
if (fs.existsSync(path.join(projectRoot, 'apps/admin/src/app/admin/components'))) {
  fs.renameSync(
    path.join(projectRoot, 'apps/admin/src/app/admin/components'),
    path.join(projectRoot, 'apps/admin/src/app/components')
  );
}

// 4. Move admin/page.tsx to root page.tsx
if (fs.existsSync(path.join(projectRoot, 'apps/admin/src/app/admin/page.tsx'))) {
  fs.renameSync(
    path.join(projectRoot, 'apps/admin/src/app/admin/page.tsx'),
    path.join(projectRoot, 'apps/admin/src/app/page.tsx')
  );
}

// 5. Remove empty admin dir
if (fs.existsSync(path.join(projectRoot, 'apps/admin/src/app/admin'))) {
  fs.rmdirSync(path.join(projectRoot, 'apps/admin/src/app/admin'));
}

// 6. Move api/admin contents to api directory
const apiAdminDir = path.join(projectRoot, 'apps/admin/src/app/api/admin');
const apiDir = path.join(projectRoot, 'apps/admin/src/app/api');

if (fs.existsSync(apiAdminDir)) {
  const items = fs.readdirSync(apiAdminDir);
  for (const item of items) {
    fs.renameSync(
      path.join(apiAdminDir, item),
      path.join(apiDir, item)
    );
  }
  fs.rmdirSync(apiAdminDir);
}

console.log("Moves completed successfully");
