/**
 * Adsterra Banner Ad Component (468x60)
 *
 * Sandboxed inside an <iframe srcDoc> so the Adsterra script runs inside
 * a completely isolated window. When this component unmounts (user navigates
 * away from /coins), the iframe is destroyed and all of Adsterra's event
 * listeners / popunder hooks go with it — they never affect the parent page.
 */
export default function BannerAd() {
  const adHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;display:flex;justify-content:center}</style>
</head>
<body>
  <script type="text/javascript">
    atOptions = {
      'key'    : 'b56912540f46f2be44d0b824ad0e3a92',
      'format' : 'iframe',
      'height' : 60,
      'width'  : 468,
      'params' : {}
    };
  </script>
  <script type="text/javascript" async="false"
    src="https://www.highperformanceformat.com/b56912540f46f2be44d0b824ad0e3a92/invoke.js">
  </script>
</body>
</html>`

  return (
    <div className="flex justify-center items-center p-4">
      <iframe
        srcDoc={adHtml}
        sandbox="allow-scripts allow-popups"
        referrerPolicy="no-referrer-when-downgrade"
        style={{ width: "468px", height: "60px", border: "none", display: "block" }}
        title="Advertisement"
        loading="lazy"
      />
    </div>
  )
}
