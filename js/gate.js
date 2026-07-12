/* MOXIE AI Insights — Password Gate
 *
 * Site default PIN is 8675. Client pages (/clients/NNNNNNN/…) can have a
 * custom 4-digit PIN, set in the admin panel and stored in the client-content
 * blob (meta.pin). Non-client pages always use the default.
 */
(function () {
  var DEFAULT_PIN = '8675';
  var LEGACY_KEY = 'moxie_auth';
  var LEGACY_HASH = 'ODY3NQ=='; // base64 of the default pin

  // Admin bypass
  if (localStorage.getItem('moxie_admin') === 'MDgwMzE3') return;

  var m = location.pathname.match(/^\/clients\/(\d+)(\/|$)/);
  var clientNum = m ? m[1] : null;
  var KEY = clientNum ? 'moxie_auth_' + clientNum : LEGACY_KEY;

  // Resolve the expected PIN. Custom pins only exist for client pages;
  // if the lookup fails (offline, local preview) fall back to the default.
  var pinPromise;
  if (clientNum) {
    pinPromise = fetch('/.netlify/functions/client-content?client=' + clientNum + '&cb=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var p = d && d.meta && d.meta.pin;
        return (typeof p === 'string' && /^\d{4}$/.test(p)) ? p : DEFAULT_PIN;
      })
      .catch(function () { return DEFAULT_PIN; });
  } else {
    pinPromise = Promise.resolve(DEFAULT_PIN);
  }

  var stored = localStorage.getItem(KEY);
  // Clients authed before per-client pins existed only have the global key —
  // keep honoring it as long as this client is still on the default pin.
  var legacyOk = clientNum && localStorage.getItem(LEGACY_KEY) === LEGACY_HASH;

  if (stored || legacyOk) {
    // Stay unlocked optimistically; re-lock if the pin changed since last visit.
    pinPromise.then(function (pin) {
      if (stored === btoa(pin) || (legacyOk && pin === DEFAULT_PIN)) {
        localStorage.setItem(KEY, btoa(pin));
      } else {
        localStorage.removeItem(KEY);
        showGate();
      }
    });
    return;
  }

  showGate();

  function showGate() {
    var overlay = document.createElement('div');
    overlay.className = 'gate-overlay';
    overlay.innerHTML =
      '<div class="gate-box">' +
        '<img src="/assets/moxie-mascot-small.png" alt="MOXIE" style="width:100px;height:100px;margin:0 auto 12px;display:block;">' +
        '<h1>MOXIE AI Insights</h1>' +
        '<p>Enter your access code to continue</p>' +
        '<input type="password" id="gate-input" placeholder="Access Code" maxlength="10" autocomplete="off" inputmode="numeric">' +
        '<button id="gate-btn" style="display:block;width:100%;margin-top:12px;padding:12px;background:#DF6229;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;letter-spacing:0.5px;">Enter</button>' +
        '<div class="gate-error" id="gate-error">Incorrect code. Please try again.</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var input = document.getElementById('gate-input');
    var btn = document.getElementById('gate-btn');
    var error = document.getElementById('gate-error');

    function tryAuth() {
      var entered = input.value;
      pinPromise.then(function (pin) {
        if (entered === pin) {
          localStorage.setItem(KEY, btoa(pin));
          overlay.remove();
        } else {
          error.style.display = 'block';
          input.value = '';
          input.focus();
        }
      });
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') tryAuth();
    });

    btn.addEventListener('click', tryAuth);

    setTimeout(function () { input.focus(); }, 100);
  }
})();
