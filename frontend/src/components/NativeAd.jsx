/**
 * Adsterra Native Banner Ad Component
 *
 * Sandboxed inside an <iframe srcDoc> so the Adsterra script runs inside
 * a completely isolated window. When this component unmounts (user navigates
 * away from /coins), the iframe is destroyed and all of Adsterra's event
 * listeners / popunder hooks go with it — they never affect the parent page.
 */
export default function NativeAd({ placement = null }) {
  const containerId = placement?.containerId || (placement?.key ? `container-${placement.key}` : null)
  const scriptSrc = placement?.script || (placement?.key ? `https://pl28770653.effectivegatecpm.com/${placement.key}/invoke.js` : null)
  const iframeUrl = placement?.type === "iframe" ? placement?.url : null

  if (iframeUrl) {
    return (
      <div className="w-full">
        <iframe
          src={iframeUrl}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer-when-downgrade"
          style={{ width: "100%", minHeight: `${Math.max(120, Number(placement?.height || 120))}px`, border: "none", display: "block" }}
          title="Advertisement"
          loading="lazy"
        />
      </div>
    )
  }

  if (!scriptSrc || !containerId) {
    return (
      <div className="flex justify-center items-center p-4 text-xs text-slate-500">
        Native ad is not configured.
      </div>
    )
  }

  // Build a self-contained HTML document that loads the ad inside the iframe.
  // allow-popups lets Adsterra open new tabs as intended for this ad format.
  const adHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style>
</head>
<body>
  <div id="${containerId}"></div>
  <script async data-cfasync="false"
    src="${scriptSrc}">
  </script>
</body>
</html>`

  return (
    <div className="w-full">
      <iframe
        srcDoc={adHtml}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        // allow-scripts  — lets the ad JS execute inside the iframe
        // allow-popups   — lets Adsterra open advertiser tabs (required for revenue)
        // NO allow-top-navigation — prevents the ad from redirecting the parent page
        referrerPolicy="no-referrer-when-downgrade"
        style={{ width: "100%", minHeight: `${Math.max(120, Number(placement?.height || 120))}px`, border: "none", display: "block" }}
        title="Advertisement"
        loading="lazy"
      />
    </div>
  )
}
