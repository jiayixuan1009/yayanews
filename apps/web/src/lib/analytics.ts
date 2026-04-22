'use client';

/**
 * 报告要求的 6 组监控数据中，代码侧可埋的 3 组：
 *   - 频道页表现          → page_view 已由 GA4 自动采集 + 自定义维度 content_section
 *   - 详情页到主站点击率  → trackOutbound('mainsite_cta' | 'trading_cta' | 'source_link', url)
 *   - 注册归因页          → trackConversion('register_click', url)
 *
 * 其余 3 组（已收录页数、展现页数、点击页数）来自 GSC API，与前端无关。
 *
 * 用法：
 *   import { trackOutbound, trackConversion, trackPageSection } from '@/lib/analytics';
 */

/** GA4 gtag 安全调用包装，GA 未加载时静默跳过 */
function gtag(...args: any[]) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    (window as any).gtag(...args);
  }
}

/**
 * 追踪外部导流点击（主站、交易站、原文来源）
 * @param label  链接标识，用于 GA4 event_label 维度
 * @param url    目标 URL
 * @param source 来源页面类型（article | flash | cta_banner | footer | category）
 */
export function trackOutbound(
  label: 'mainsite_cta' | 'trading_cta' | 'source_link' | 'social_link',
  url: string,
  source: string = 'unknown'
) {
  gtag('event', 'outbound_click', {
    event_category: 'outbound',
    event_label: label,
    outbound_url: url,
    source_context: source,
    // GA4 recommended param for outbound link measurement
    link_url: url,
  });
}

/**
 * 追踪注册/导流按钮点击（用于注册归因页）
 * @param url  目标 URL（应含 utm 参数）
 */
export function trackConversion(url: string) {
  gtag('event', 'conversion_click', {
    event_category: 'conversion',
    event_label: 'register',
    outbound_url: url,
  });
}

/**
 * 追踪频道页内容板块曝光（用于频道页表现分析）
 * @param section  频道 slug（us-stock / crypto / hk-stock / derivatives 等）
 * @param type     页面类型（category | topic | tag）
 */
export function trackPageSection(section: string, type: 'category' | 'topic' | 'tag' = 'category') {
  gtag('event', 'content_section_view', {
    event_category: 'navigation',
    content_section: section,
    page_type: type,
  });
}
