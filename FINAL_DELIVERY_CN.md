# YayaNews Stitch 改版最终交付说明

> ⚠️ **架构更新（2026-04）**：数据层已从 SQLite 全量迁移至 PostgreSQL（pgvector）。
> 下文中涉及 `SQLite` / `src/lib/queries.ts` 的段落记录的是当时交付时的实现；
> 当前真实架构请参阅 [docs/architecture.md](docs/architecture.md)、
> [packages/database/schema.sql](packages/database/schema.sql) 与
> [packages/database/migrations/](packages/database/migrations/)。

## 当前交付内容
本包是在现有 YayaNews 项目基础上的前端展示层改版版本，目标是把 Stitch 的编辑型新闻站风格接入现有 Next.js + SQLite 项目。

已完成：
- 设计系统接入（颜色、字体、基础 token）
- 首页改造
- 频道页改造（/news/[category]）
- 文章详情页改造（/article/[slug]）
- 相关共享组件统一

未改动为主：
- SQLite schema
- src/lib/queries.ts 主查询逻辑
- sitemap / robots / feed 逻辑
- next.config.mjs 与部署主协议

## 主要修改文件
- src/app/globals.css
- src/app/layout.tsx
- src/app/page.tsx
- src/app/news/[category]/page.tsx
- src/app/article/[slug]/page.tsx
- src/components/Header.tsx
- src/components/Footer.tsx
- src/components/ArticleCard.tsx
- src/components/CtaBanner.tsx
- src/components/DepthTabs.tsx
- src/components/DerivativesSubTabs.tsx
- src/components/ShareButtons.tsx
- src/components/editorial/HomeHeroEditorial.tsx
- src/components/editorial/BreakingStreamBlock.tsx
- src/components/editorial/CategoryChipsRow.tsx
- src/components/editorial/ChannelHeader.tsx
- src/components/editorial/RightRailPanel.tsx
- src/components/editorial/SectionHeader.tsx
- src/components/editorial/TopicBridge.tsx
- tailwind.config.ts

## 如何在本地验证
建议在你自己的开发机或服务器项目目录执行：

```bash
npm install
npm run build
npm run start
```

开发模式：

```bash
npm install
npm run dev
```

## 为什么这里没有宣称“已完整构建通过”
在当前交付容器里，项目自带的 node_modules 不是一个可信的完整安装状态，缺少 next / typescript 等本地可执行入口，导致这里的 build 结果不能作为源码是否可用的可靠依据。

因此，本交付对“文件已修改完成”可以确认；对“你的真实环境里完整 build 成功”需要你在本地或服务器目录执行 npm install 后验证。

## 建议的上线前检查清单
1. npm install 后执行 npm run build
2. 检查首页 /news/[category] /article/[slug] 三类页面
3. 检查 Header / Footer 在全站其他页面是否样式协调
4. 检查 metadata、OG、canonical 是否正常
5. 检查远程图片是否可访问
6. 检查 sitemap、robots、RSS/News sitemap 是否未受影响
7. 检查暗色旧 class 残留组件是否影响非核心页面

## 备注
本次交付优先保证：
- 不推翻现有数据层
- 不改数据库结构
- 不改变既有路由协议
- 先完成核心三页统一

如果你要继续下一轮，建议做：
- 非核心页面统一
- Header / Footer 最终精修
- 文章正文模块化（引用、表格、信息框）
- 主题色与频道色阶精细化
