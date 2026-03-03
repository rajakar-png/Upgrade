/**
 * adBlockDetector.js — reliable adblock detection.
 *
 * Methods (run in parallel, ANY returning true = blocked):
 *
 *   1. Fetch probe to real ad-network domains (PRIMARY)
 *      Uses fetch({mode:'no-cors'}) against the ACTUAL Adsterra and Google
 *      Ads domains that are confirmed to be blocked by uBlock/Brave/ABP.
 *      When adblock intercepts the request the fetch throws a TypeError —
 *      clean browsers get an opaque-200 response.
 *      Tries two domains; either blocked = adblock detected.
 *
 *   2. Script-tag probe (SECONDARY)
 *      Injects a <script> pointing at pagead2.googlesyndication.com.
 *      onerror = blocked. Catches blockers that intercept script loading
 *      differently from fetch().
 *
 *   3. Bait element CSS check (DOM filter lists)
 *      Insert a div with class names targeted by EasyList / uBlock cosmetic
 *      filters. If hidden or removed = blocked.
 *
 * NOTE: Self-hosted bait files do NOT work — ad blockers block by domain,
 * not just URL path. Files served from the app's own domain are never blocked.
 *
 * NOTE: navigator.brave.isBrave() is NOT used — it returns true for any Brave
 * browser regardless of shield state, causing false positives.
 *
 * Returns Promise<boolean>: true = adblocker detected, false = clean.
 */

// The exact ad-network domains your site loads — confirmed blocked by the browser logs.
// Using these specific domains guarantees the probe matches what ad blockers actually target.
const AD_PROBE_DOMAINS = [
  "https://pl28770653.effectivegatecpm.com",
  "https://www.highperformanceformat.com"
]

// ─── Method 1: Real ad-domain fetch probe ────────────────────────────────────
// mode:'no-cors' avoids CORS preflight; a clean browser gets an opaque response.
// An adblock extension cancels the request → fetch throws TypeError.
// We probe the same domains that the real ads load from, so any blocker
// that blocks the ads will also block this probe.
async function checkAdNetworkFetch() {
  const ts = Date.now()
  // Try all domains in parallel — if ANY throws, adblock is active.
  const results = await Promise.all(
    AD_PROBE_DOMAINS.map(async (base) => {
      try {
        await fetch(`${base}/favicon.ico?_=${ts}`, { mode: "no-cors", cache: "no-store" })
        return false // opaque response = not blocked
      } catch {
        return true // fetch threw = blocked
      }
    })
  )
  return results.some(Boolean)
}

// ─── Method 2: Script-tag probe ──────────────────────────────────────────────
// Injects a <script> from the actual ad domain. onerror = blocked.
// Catches blockers that intercept script loading but not fetch().
function checkAdNetworkScript() {
  return new Promise((resolve) => {
    const script = document.createElement("script")
    // Use the known invoke.js path from actual ad logs
    script.src = `https://pl28770653.effectivegatecpm.com/ea5f1c0a65197deceee484aa52672b4d/invoke.js?_=${Date.now()}`
    script.async = true

    let settled = false
    const settle = (result) => {
      if (settled) return
      settled = true
      script.remove()
      resolve(result)
    }

    // 3s timeout — if nothing fires, treat as not blocked (conservative)
    const timer = setTimeout(() => settle(false), 3000)

    script.onload = () => { clearTimeout(timer); settle(false) } // loaded = not blocked
    script.onerror = () => { clearTimeout(timer); settle(true)  } // error = blocked

    document.head.appendChild(script)
  })
}

// ─── Method 3: Bait element ──────────────────────────────────────────────────
// Wait 350ms so Brave/uBlock async cosmetic filters have time to apply.
function checkBaitElement() {
  return new Promise((resolve) => {
    const bait = document.createElement("div")
    bait.className = [
      "ad", "ads", "adsbox", "ad-placement", "carbon-ads",
      "doubleclick", "ad-container", "ad-slot", "GoogleActiveViewElement",
      "adsbygoogle"
    ].join(" ")
    bait.setAttribute("data-ad-status", "unfilled")
    bait.innerHTML = "&nbsp;"
    bait.style.cssText = [
      "width:1px", "height:1px", "position:absolute",
      "left:-9999px", "top:-9999px", "pointer-events:none"
    ].join(";")

    document.body.appendChild(bait)

    setTimeout(() => {
      let blocked = false
      try {
        // Element removed entirely by some blockers
        if (!document.body.contains(bait)) {
          return resolve(true)
        }
        const computed = window.getComputedStyle(bait)
        blocked = (
          bait.offsetHeight === 0 ||
          bait.offsetWidth  === 0 ||
          bait.offsetParent === null ||
          computed.display      === "none" ||
          computed.visibility   === "hidden" ||
          computed.opacity      === "0"
        )
      } catch {
        blocked = true
      } finally {
        bait.remove()
      }
      resolve(blocked)
    }, 350)
  })
}

// ─── Public API ──────────────────────────────────────────────────────────────
/**
 * Run all three methods in parallel.
 * Returns true if ANY method detects an adblocker.
 * @returns {Promise<boolean>}
 */
export async function detectAdBlock() {
  try {
    const [fetchBlocked, scriptBlocked, bait] = await Promise.all([
      checkAdNetworkFetch(),
      checkAdNetworkScript(),
      checkBaitElement()
    ])

    const blocked = fetchBlocked || scriptBlocked || bait
    const reasons = [
      fetchBlocked  && "ad-fetch",
      scriptBlocked && "ad-script",
      bait          && "bait-element"
    ].filter(Boolean)
    console.debug("[AdBlock]", blocked ? `Detected via: ${reasons.join(", ")}` : "Clean")
    return blocked
  } catch {
    return false
  }
}

