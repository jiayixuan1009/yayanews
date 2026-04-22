'use client';

import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-M5TYCGL732';
const BING_UET = process.env.NEXT_PUBLIC_BING_UET_ID;
const CLARITY_ID = process.env.NEXT_PUBLIC_MS_CLARITY_ID;

/**
 * Google Analytics 4、Bing UET、Microsoft Clarity（均通过环境变量开关，未配置则不加载）
 */
export default function Analytics() {
  return (
    <>
      {GA_ID ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="lazyOnload"
          />
          <Script id="ga4-gtag" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true });
            `}
          </Script>
        </>
      ) : null}

      {BING_UET ? (
        <Script id="bing-uet" strategy="lazyOnload">
          {`
(function(w,d,t,r,u){
  var f,n,i;w[u]=w[u]||[];
  f=function(){var o={ti:"${BING_UET}"};o.q=w[u];w[u]=new UET(o);w[u].push("pageLoad")};
  n=d.createElement(t);n.src=r;n.async=1;
  n.onload=n.onreadystatechange=function(){
    var s=this.readyState;s&&s!=="loaded"&&s!=="complete"||(f(),n.onload=n.onreadystatechange=null)
  };
  i=d.getElementsByTagName(t)[0];i.parentNode.insertBefore(n,i)
})(window,document,"script","https://bat.bing.com/bat.js","uetq");
          `}
        </Script>
      ) : null}

      {CLARITY_ID ? (
        <Script id="ms-clarity" strategy="lazyOnload">
          {`
(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_ID}");
          `}
        </Script>
      ) : null}
    </>
  );
}
