/**
 * Adsterra Native Banner Ad Component
 *
 * Sandboxed inside an <iframe srcDoc> so the Adsterra script runs inside
 * a completely isolated window. When this component unmounts (user navigates
 * away from /coins), the iframe is destroyed and all of Adsterra's event
 * listeners / popunder hooks go with it — they never affect the parent page.
 */
export default function NativeAd() {
  // Build a self-contained HTML document that loads the ad inside the iframe.
  // allow-popups lets Adsterra open new tabs as intended for this ad format.
  const adHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style>
</head>
<body>
  <div id="container-ea5f1c0a65197deceee484aa52672b4d"></div>
  <script async data-cfasync="false"
    src="https://pl28770653.effectivegatecpm.com/ea5f1c0a65197deceee484aa52672b4d/invoke.js">
  </script>
</body>
</html>`

  return (
    <div className="w-full">
      <iframe
        srcDoc={adHtml}
        sandbox="allow-scripts allow-popups"
        // allow-scripts  — lets the ad JS execute inside the iframe
        // allow-popups   — lets Adsterra open advertiser tabs (required for revenue)
        // NO allow-top-navigation — prevents the ad from redirecting the parent page
        referrerPolicy="no-referrer-when-downgrade"
        style={{ width: "100%", minHeight: "120px", border: "none", display: "block" }}
        title="Advertisement"
        loading="lazy"
      />
    </div>
  )
}
