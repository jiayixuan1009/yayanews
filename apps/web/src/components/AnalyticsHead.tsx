/* eslint-disable @next/next/next-script-for-ga -- GSC GA ownership verification requires a literal gtag snippet in <head>. */
const DEFAULT_GA_MEASUREMENT_ID = 'G-M5TYCGL732';

function normalizeGaId(value: string | undefined): string {
  const id = (value || '').trim();
  return /^G-[A-Z0-9]+$/i.test(id) ? id : '';
}

function normalizeGtmId(value: string | undefined): string {
  const id = (value || '').trim();
  return /^GTM-[A-Z0-9]+$/i.test(id) ? id : '';
}

const GA_ID = normalizeGaId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || DEFAULT_GA_MEASUREMENT_ID);
const GTM_ID = normalizeGtmId(
  process.env.NEXT_PUBLIC_GTM_CONTAINER_ID
    || process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID
);

export default function AnalyticsHead() {
  return (
    <>
      {GA_ID ? (
        <>
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true });
            `,
            }}
          />
        </>
      ) : null}

      {GTM_ID ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          `,
          }}
        />
      ) : null}
    </>
  );
}

export function GoogleTagManagerNoScript() {
  if (!GTM_ID) return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
