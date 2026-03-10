/**
 * Adsterra Banner Ad Component (468x60)
 *
 * Sandboxed inside an <iframe srcDoc> so the Adsterra script runs inside
 * a completely isolated window. When this component unmounts (user navigates
 * away from /coins), the iframe is destroyed and all of Adsterra's event
 * listeners / popunder hooks go with it — they never affect the parent page.
 */
export default function BannerAd({ placement = null }) {
  const key = placement?.key || null
  const width = Number(placement?.width || 468)
  const height = Number(placement?.height || 60)
  const iframeUrl = placement?.type === "iframe" ? placement?.url : null
  const scriptSrc = placement?.script || (key ? `https://www.highperformanceformat.com/${key}/invoke.js` : null)

  if (iframeUrl) {
    return (
      <div className="flex justify-center items-center p-4">
        <iframe
          src={iframeUrl}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer-when-downgrade"
          style={{ width: `${width}px`, height: `${height}px`, border: "none", display: "block", maxWidth: "100%" }}
          title="Advertisement"
          loading="lazy"
        />
      </div>
    )
  }

  if (!scriptSrc || !key) {
    return (
      <div className="flex justify-center items-center p-4 text-xs text-slate-500">
        Banner ad is not configured.
      </div>
    )
  }

  const adHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;display:flex;justify-content:center}</style>
</head>
<body>
  <script type="text/javascript">
    atOptions = {
      'key'    : '${key}',
      'format' : 'iframe',
      'height' : ${height},
      'width'  : ${width},
      'params' : {}
    };
  </script>
  <script type="text/javascript" async="false"
    src="${scriptSrc}">
  </script>
</body>
</html>`

  return (
    <div className="flex justify-center items-center p-4">
      <iframe
        srcDoc={adHtml}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer-when-downgrade"
        style={{ width: `${width}px`, height: `${height}px`, border: "none", display: "block", maxWidth: "100%" }}
        title="Advertisement"
        loading="lazy"
      />
    </div>
  )
}
