# YayaNews 一期极简且坚不可摧的部署架构方案

身为单人全栈开发者，最大的敌人不是“技术不够牛”，而是“运维内耗”。搞 Kubernetes、微服务网关、复杂的 CI/CD 容器化，只会让你的周末全耗在修修补补上。

基于你目前的 Monorepo 形态与全栈混编技术栈，这是专为你量身打造的**“不折腾、睡得着觉”**的轻量级部署方案。

---

## 1. 推荐的部署拓扑 (Topology)
不要搞复杂的集群，采用 **“计算与存储分离”的黄金单节点模式**：
- **边缘层**：Cloudflare CDN (接入 DNS，免费抵御 DDoS，加速全球访问)。
- **计算宿主 (1 台高配云主机，如阿里云 4C8G+)**：
  - Nginx (做纯网关反代) -> 拦截端口分发给 Web (3002) 和 Admin (3003)。
  - 内置 PM2：掌管 Node 生态（Web、Admin、WS）与 Python 爬虫调度。
- **持久化稳态层 (脱离计算主机)**：
  - 强烈推荐使用云厂商的 **RDS (PostgreSQL)** 和 **云原生 Redis**。

## 2. Web / Admin / Pipeline 的运行与隔离策略
在单台主机内，利用 **PM2 的 Namespace 与进程分发** 进行物理级别的隔离：
- **Web 端 (`yayanews`)**：开 `fork` 模式，限制内存上限（如 `max_memory_restart: '1G'`），防止 Next.js 内存泄漏拖垮爬虫。
- **Admin 端 (`yaya-admin`)**：独立端口 3003，即使 Web 被恶意流量打挂，Admin 依旧坚挺，让你能上去禁词或者调整策略。
- **Pipeline (`yaya-pipeline-*`)**：开启 `cluster` / 多 `instances` 模式并行执行。Python 极其容易因为网络 I/O 挂起，如果用同一个脚本跑所有任务必定死锁。分成 `daemon` (发号施令) 和 `worker` (干脏活)。

## 3. 同机 vs 独立 的取舍
- **建议同机**：`Next.js Web`, `Next.js Admin`, `WS-Server`, `Python Pipeline`。它们都吃 CPU，而且它们通过 `package.json` 或 `localhost` 进行高速的进程间通信。部署在一起可以一键 `git pull && pm2 restart` 原子更迭。
- **坚决独立出这台机器**：**数据库底层（PostgreSQL / Redis）**。单机最怕的是 Python 把 CPU 和内存全吃光，导致同机的 MySQL/PG 直接 OOM 宕机，数据库一旦坏块，一整天的努力全白费。

## 4. 存储、缓存、图片的极简方案
- **PostgreSQL / Redis**：不要自己用 Docker 部署如果你的目标是“稳”。买云厂商的入门级 PaaS 服务。它们自带每天凌晨自动全量备份，出了事点一下鼠标就能回滚。
- **静态图片 / 资源 (对象存储)**：绝对不要把爬虫扒回来的图片存在 `apps/web/public` 里！会导致 Git 仓库爆仓、每次打包慢如蜗牛。请申请阿里云 OSS 或是 AWS S3，拿到一个外网 URL 直接存进 Postgres。
- **CDN**：套一层 Cloudflare 免费版，在面板里把 `/api` 排除缓存，把静态 `.js/.png` 全缓存。

## 5. Docker vs PM2 vs systemd 如何选？
单人开发极度容易陷入这三者的混乱中。请遵循以下标准：
- **Docker 只用来跑“别人的软件”**：如果实在没钱买 RDS，那就用 Docker 跑 PostgreSQL 和 Redis。**绝对不要用 Docker 跑你刚写的 Next.js 和 Python 代码！** 因为单人查 Docker 日志、进容器改变量极其痛苦。
- **PM2 只用来跑“你写的代码”**：`pm2 logs` 和 `pm2 monit` 极其符合人类直觉。Web、Admin、WS、Pipeline，全员用 `ecosystem.config.cjs` 统一管控。
- **systemd 只用来做一件事**：执行 `pm2 startup` 后生成的守护脚本，确保服务器重启后把 PM2 拉起来就行了。

## 6. 当前宿主机混编形态该如何收敛？
不要再把前端打包放到 Nginx 里再配代理，也不要一半代码用 Dockerfile 瞎包。
**统一出口**：所有的 `apps/*` 源码在宿主机通过 `npm ci` 拉取，执行一次跨包环境的 `npm run build`，最后执行一次 `pm2 reload`。让 PM2 成为应用层的最高元首。

## 7. 一期最推荐的轻量服务器组装方案
**架构清单**：
- **Domain**: Cloudflare 代理，配置 HTTPS。
- **Server**: 阿里云 Ubuntu 22.04。装好 Nginx、Node v18+、Python 3.10+、PM2。
- **DB**: 阿里云 RDS Postgres (入门版)。
- **操作流**：开发完 $\rightarrow$ Git Push $\rightarrow$ SSH 连入执行你的原子发布三段流 $\rightarrow$ 去 PM2 看一遍绿灯。

## 8. 如何保证部署后整体完整可运行？
- **Build 时强校验**：我们在上一段搞的 Node.js 静态脱水打包（Standalone），本身就是最好的编译器。它会把所有跨工作区的依赖（像 `@yayanews/seo`等）物理复制过来，脱水后如果能跑，生产环境 100% 能跑。
- **.env.example 契约精神**：规定任何人（你自己）加了系统级环境变量，必须先更新到 `.env.example`。这防范了“本地跑得通，远端由于缺 KEY 挂了”的尴尬。

## 9. 最小化的“睡个好觉”保障系统 (监控告警)
作为独立开发者，不用配牛逼的 Prometheus/Grafana，只做三点：
1. **日志切割**：执行 `pm2 install pm2-logrotate`，防止 Python 输出海量日志把系统 SSD 硬盘撑爆直接宕机。
2. **内存兜底**：在 PM2 配置中写入 `max_memory_restart: "4G"`（对 Python 爬虫极为重要），内存泄漏了就让 PM2 砍死它重生，别让它搞崩机器。
3. **白嫖报警**：写一个 10 行的 Python 脚本，只要 `yaya-pipeline-daemon` 抓到未捕获的重特大异常，调用 `Server酱` / `Telegram Bot` 的 Webhook 给你的手机弹条微信/消息。

## 10. 绝对要避免的复杂坑点 (Anti-patterns)
- ❌ **别碰 K8s/Docker Compose 做你自己的应用层编排**：调试排错成本远超单机 PM2。
- ❌ **别搞前端静态导出托管 (Vercel/Netlify)**：因为你带有重度的后端业务和 WebSocket，放在同一个云主机配合 Nginx 才是低延迟王道。
- ❌ **别人工改线上的表结构**：一定学会在 `Packages/database` 里维护 `.sql`，然后在本地生成。千万别用 Navicat 直连生产环境悄悄改字段，然后忘在代码里同步。
