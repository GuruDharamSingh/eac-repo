// The browsers the bench runs the harness drivers in. `touch: true` makes the shim turn every mouse action
// into a touch action (pw-shim.cjs); `lock: true` makes a driver's setViewportSize a no-op.
const PHONE_UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36";
const PHONE_UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const TABLET_UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";
const TABLET_UA_IOS = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const touch = (w, h, ua) => ({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: ua });

module.exports = {
  // The control: the same shim, the same image, a desktop mouse. A failure here is about the bench or the newer Chromium, not touch.
  "chromium-desktop": { browser: "chromium", context: { viewport: { width: 1500, height: 950 } } },
  "firefox-desktop": { browser: "firefox", context: { viewport: { width: 1500, height: 950 } } },
  "webkit-desktop": { browser: "webkit", context: { viewport: { width: 1500, height: 950 } } },
  "chromium-touch-390": { browser: "chromium", touch: true, lock: true, context: touch(390, 844, PHONE_UA_ANDROID) },
  "webkit-touch-390": { browser: "webkit", touch: true, lock: true, context: touch(390, 844, PHONE_UA_IOS) },
  // 820x1180 is an iPad Air in portrait; the Chromium run is the same shape on Android.
  "chromium-touch-820": { browser: "chromium", touch: true, lock: true, context: touch(820, 1180, TABLET_UA_ANDROID) },
  "webkit-touch-820": { browser: "webkit", touch: true, lock: true, context: touch(820, 1180, TABLET_UA_IOS) },
};
