'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';

interface Topic {
  id: number;
  slug: string;
  name_zh: string;
  name_en: string;
  description_zh: string | null;
  description_en: string | null;
  status: 'draft' | 'active' | 'archive';
  article_count: number;
  updated_at?: string;
  topic_type?: string;
  market?: string;
  keywords?: string[];
  related_tickers?: string[];
  hero_summary_zh?: string | null;
  hero_summary_en?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  faq_items?: any[];
}

interface FeaturedArticle {
  id: number;
  title: string;
  slug: string;
  published_at: string | null;
  sort_order: number;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  active:  { label: '上线', cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  draft:   { label: '草稿', cls: 'bg-slate-500/15 text-slate-400 border border-slate-600' },
  archive: { label: '归档', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
};

const EMPTY_FORM = {
  slug: '', name_zh: '', name_en: '',
  description_zh: '', description_en: '',
  status: 'draft' as 'draft' | 'active' | 'archive', cover_image: '',
  topic_type: 'narrative', market: 'us-stock',
  keywords: '', related_tickers: '',
  hero_summary_zh: '', hero_summary_en: '',
  meta_title: '', meta_description: '',
  faq_items: '[]',
};

export default function TopicsView() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Topic | null>(null);
  const [featured, setFeatured] = useState<FeaturedArticle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [featuredInput, setFeaturedInput] = useState('');
  const [discovering, setDiscovering] = useState(false);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/topics', { headers: { 'x-admin-secret': 'yayanews2024' } });
      const data = await res.json();
      setTopics(data.topics || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const fetchFeatured = useCallback(async (topicId: number) => {
    try {
      const res = await adminFetch(`/api/admin/topics/${topicId}`, { headers: { 'x-admin-secret': 'yayanews2024' } });
      const data = await res.json();
      setFeatured(data.featured || []);
    } catch { setFeatured([]); }
  }, []);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditMode(false);
    setShowForm(true);
    setSelected(null);
    setMsg(null);
  }

  function openEdit(t: Topic) {
    setForm({
      slug: t.slug,
      name_zh: t.name_zh || '',
      name_en: t.name_en || '',
      description_zh: t.description_zh || '',
      description_en: t.description_en || '',
      status: t.status,
      cover_image: '',
      topic_type: t.topic_type || 'narrative',
      market: t.market || 'us-stock',
      keywords: t.keywords?.join(', ') || '',
      related_tickers: t.related_tickers?.join(', ') || '',
      hero_summary_zh: t.hero_summary_zh || '',
      hero_summary_en: t.hero_summary_en || '',
      meta_title: t.meta_title || '',
      meta_description: t.meta_description || '',
      faq_items: t.faq_items ? JSON.stringify(t.faq_items, null, 2) : '[]',
    });
    setEditMode(true);
    setSelected(t);
    setShowForm(true);
    fetchFeatured(t.id);
    setMsg(null);
  }

  async function handleSave() {
    setSaving(true); setMsg(null);
    const url = editMode && selected ? `/api/admin/topics/${selected.id}` : '/api/admin/topics';
    const method = editMode ? 'PUT' : 'POST';
    
    try {
      let parsedFaq = [];
      try {
        parsedFaq = JSON.parse(form.faq_items || '[]');
      } catch (e) {
        setMsg({ type: 'err', text: 'FAQ 格式错误：不仅是有效的 JSON' });
        setSaving(false);
        return;
      }

      const payload = {
        ...form,
        keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
        related_tickers: form.related_tickers.split(',').map(s => s.trim()).filter(Boolean),
        faq_items: parsedFaq,
      };

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'yayanews2024' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'err', text: data.error || '保存失败' }); }
      else { setMsg({ type: 'ok', text: editMode ? '更新成功！' : '专题创建成功！' }); fetchTopics(); }
    } catch (e) { setMsg({ type: 'err', text: String(e) }); }
    setSaving(false);
  }

  async function handleArchive(t: Topic) {
    if (!confirm(`确认归档专题「${t.name_zh}」？\n归档后不可恢复为上线状态（不可继续新增文章），但 URL 保持有效。`)) return;
    await adminFetch(`/api/admin/topics/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'yayanews2024' },
      body: JSON.stringify({ status: 'archive' }),
    });
    fetchTopics();
  }

  async function handleAddFeatured() {
    if (!selected) return;
    const ids = featuredInput.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    const merged = Array.from(new Set([...featured.map(f => f.id), ...ids])).slice(0, 6);
    const res = await adminFetch(`/api/admin/topics/${selected.id}/featured`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'yayanews2024' },
      body: JSON.stringify({ article_ids: merged }),
    });
    const data = await res.json();
    if (res.ok) { setMsg({ type: 'ok', text: `精选已更新（${data.count} 篇）` }); fetchFeatured(selected.id); setFeaturedInput(''); }
    else { setMsg({ type: 'err', text: data.error }); }
  }

  async function removeFeatured(articleId: number) {
    if (!selected) return;
    const newIds = featured.filter(f => f.id !== articleId).map(f => f.id);
    await adminFetch(`/api/admin/topics/${selected.id}/featured`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': 'yayanews2024' },
      body: JSON.stringify({ article_ids: newIds }),
    });
    fetchFeatured(selected.id);
  }

  async function handleAutoDiscover() {
    if (!confirm('这将会触发大语言模型对全站近 30 天的高频标签进行扫描，耗时可能较长（约10-30秒）。是否开始？')) return;
    setDiscovering(true);
    try {
      const res = await adminFetch('/api/admin/topics/generate', {
        method: 'POST',
        headers: { 'x-admin-secret': 'yayanews2024' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.createdTopics && data.createdTopics.length > 0) {
          alert(`🎉 挖掘成功！共识别并自动聚合了 ${data.createdTopics.length} 个新突发事件专题，并已移入草稿箱。`);
        } else {
          alert('✅ 扫描完毕。当前没有足够热度或无符合事件标准的新专题候选。');
        }
        fetchTopics();
      } else {
        alert(`❌ 探索失败：${data.error || '服务器未知错误'}`);
      }
    } catch (e) {
      alert(`❌ 网络错误：${String(e)}`);
    }
    setDiscovering(false);
  }

  return (
    <div className="space-y-6">
      {/* 顶栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">专题管理</h2>
          <p className="mt-1 text-sm text-slate-400">管理内容专题，构建 Hub-Spoke 内链网络</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAutoDiscover}
            disabled={discovering}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {discovering ? '系统推演中...' : '✨ AI 全域嗅探发现'}
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            手工建专题
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,400px]">
        {/* 专题列表 */}
        <div className="space-y-2">
          {loading ? (
            <p className="py-12 text-center text-slate-500">加载中…</p>
          ) : topics.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 py-16 text-center">
              <p className="text-slate-500">暂无专题</p>
              <button onClick={openCreate} className="mt-3 text-sm text-emerald-400 hover:text-emerald-300">
                点此创建第一个专题 →
              </button>
            </div>
          ) : (
            topics.map(t => (
              <div
                key={t.id}
                className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors cursor-pointer ${
                  selected?.id === t.id ? 'border-emerald-600/50 bg-emerald-950/30' : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                }`}
                onClick={() => openEdit(t)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_LABELS[t.status]?.cls}`}>
                      {STATUS_LABELS[t.status]?.label}
                    </span>
                    <span className="truncate font-medium text-white">{t.name_zh || t.slug}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    /{t.slug} · {t.article_count || 0} 篇文章
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(t); }}
                    className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-white"
                  >编辑</button>
                  {t.status !== 'archive' && (
                    <button
                      onClick={e => { e.stopPropagation(); handleArchive(t); }}
                      className="rounded px-2 py-1 text-xs text-amber-500 hover:bg-amber-500/10"
                    >归档</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 编辑面板 */}
        {showForm && (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5 space-y-4 overflow-y-auto max-h-[80vh]">
            <h3 className="font-semibold text-white">{editMode ? `编辑：${selected?.name_zh}` : '新建专题'}</h3>

            {msg && (
              <div className={`rounded px-3 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
                {msg.text}
              </div>
            )}

            {/* Slug（仅新建时可改） */}
            <div>
              <label className="block mb-1 text-xs font-medium text-slate-400">URL Slug *</label>
              <input
                type="text"
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                disabled={editMode}
                placeholder="bitcoin-halving-2024"
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-slate-600">只能使用小写字母、数字、连字符。发布后不可修改。</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-xs font-medium text-slate-400">专题类型</label>
                <select value={form.topic_type} onChange={e => setForm(f => ({ ...f, topic_type: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
                  <option value="company">公司实体</option>
                  <option value="macro">宏观经济</option>
                  <option value="crypto_event">加密事件</option>
                  <option value="narrative">主线叙事</option>
                  <option value="earnings">财报季</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-xs font-medium text-slate-400">所属市场</label>
                <select value={form.market} onChange={e => setForm(f => ({ ...f, market: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
                  <option value="us-stock">美股市场</option>
                  <option value="hk-stock">港股/亚洲</option>
                  <option value="crypto">加密资产</option>
                  <option value="derivatives">衍生品/外汇</option>
                  <option value="ai">AI前沿</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-xs font-medium text-slate-400">中文标题 *</label>
                <input type="text" value={form.name_zh} onChange={e => setForm(f => ({ ...f, name_zh: e.target.value }))}
                  placeholder="比特币减半 2024"
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600" />
              </div>
              <div>
                <label className="block mb-1 text-xs font-medium text-slate-400">英文标题 *</label>
                <input type="text" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
                  placeholder="Bitcoin Halving 2024"
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600" />
              </div>
            </div>

            <div>
              <label className="block mb-1 text-xs font-medium text-slate-400">中文 Hero 概要</label>
              <textarea rows={2} value={form.hero_summary_zh} onChange={e => setForm(f => ({ ...f, hero_summary_zh: e.target.value }))}
                placeholder="短小的概要描述，显示在页面顶部..."
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-none" />
            </div>

            <div>
              <label className="block mb-1 text-xs font-medium text-slate-400">英文 Hero 概要</label>
              <textarea rows={2} value={form.hero_summary_en} onChange={e => setForm(f => ({ ...f, hero_summary_en: e.target.value }))}
                placeholder="Short summary for the hero section..."
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-none" />
            </div>

            <div>
              <label className="block mb-1 text-xs font-medium text-slate-400">
                中文定义文本 * &nbsp;
                <span className={`${form.description_zh.length < 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {form.description_zh.length} 字{form.description_zh.length < 50 && '（至少50字才能激活）'}
                </span>
              </label>
              <textarea rows={5} value={form.description_zh}
                onChange={e => setForm(f => ({ ...f, description_zh: e.target.value }))}
                placeholder="描述该专题的时间背景、市场意义和本站覆盖角度，至少 150 字效果最佳…"
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-none" />
            </div>

            <div>
              <label className="block mb-1 text-xs font-medium text-slate-400">
                英文定义文本 * &nbsp;
                <span className={`${form.description_en.length < 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {form.description_en.length} chars
                </span>
              </label>
              <textarea rows={4} value={form.description_en}
                onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))}
                placeholder="English description of this topic…"
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-none" />
            </div>
            <div>
              <label className="block mb-1 text-xs font-medium text-slate-400">SEO 优化关键词（逗号分隔）</label>
              <input type="text" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                placeholder="AI芯片, NVDA, 算力..."
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600" />
            </div>

            <div>
              <label className="block mb-1 text-xs font-medium text-slate-400">相关股票代码（逗号分隔）</label>
              <input type="text" value={form.related_tickers} onChange={e => setForm(f => ({ ...f, related_tickers: e.target.value }))}
                placeholder="NVDA, TSLA, AAPL..."
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-600" />
            </div>

            <div>
              <label className="block mb-1 text-xs font-medium text-slate-400">FAQ 列表 (JSON 数组)</label>
              <textarea rows={4} value={form.faq_items}
                onChange={e => setForm(f => ({ ...f, faq_items: e.target.value }))}
                placeholder='[{"q_zh":"问题", "a_zh":"答案", "q_en": "Question", "a_en": "Answer"}]'
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white text-mono placeholder:text-slate-600 resize-none" />
            </div>
            <div>
              <label className="block mb-1 text-xs font-medium text-slate-400">状态</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
                <option value="draft">草稿（不对外展示）</option>
                <option value="active">上线（对外可见、收录到 sitemap）</option>
                <option value="archive">归档（页面保留但停止更新）</option>
              </select>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? '保存中…' : editMode ? '保存修改' : '创建专题'}
            </button>

            {/* 精选文章管理（仅编辑已有专题时显示） */}
            {editMode && selected && (
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <h4 className="text-sm font-medium text-slate-300">
                  精选文章 <span className="text-slate-500">（{featured.length}/6）</span>
                </h4>

                {featured.length > 0 ? (
                  <ul className="space-y-1.5">
                    {featured.map(f => (
                      <li key={f.id} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 truncate text-slate-300">{f.title}</span>
                        <span className="shrink-0 text-slate-600">id:{f.id}</span>
                        <button onClick={() => removeFeatured(f.id)}
                          className="shrink-0 text-red-400 hover:text-red-300">✕</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-600">暂无精选文章</p>
                )}

                {featured.length < 6 && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={featuredInput}
                      onChange={e => setFeaturedInput(e.target.value)}
                      placeholder="输入文章 ID，多篇用逗号分隔"
                      className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder:text-slate-600"
                    />
                    <button onClick={handleAddFeatured}
                      className="rounded bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600">
                      添加
                    </button>
                  </div>
                )}
                {featured.length >= 6 && (
                  <p className="text-xs text-amber-500">已达上限（6篇），请先移除后再添加</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
