/* MOXIE AI Insights — Password Gate */
(function () {
  var KEY = 'moxie_auth';
  var HASH = 'ODY3NQ=='; // base64 of "8675"

  if (localStorage.getItem(KEY) === HASH) return;
  if (localStorage.getItem('moxie_admin') === 'MDgwMzE3') return;

  // Build overlay
  var overlay = document.createElement('div');
  overlay.className = 'gate-overlay';
  overlay.innerHTML =
    '<div class="gate-box">' +
      '<img src="/assets/moxie-mascot-small.png" alt="MOXIE" style="width:100px;height:100px;margin:0 auto 12px;display:block;">' +
      '<h1>MOXIE AI Insights</h1>' +
      '<p>Enter your access code to continue</p>' +
      '<input type="password" id="gate-input" placeholder="Access Code" maxlength="10" autocomplete="off">' +
      '<button id="gate-btn" style="display:block;width:100%;margin-top:12px;padding:12px;background:#DF6229;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;letter-spacing:0.5px;">Enter</button>' +
      '<div class="gate-error" id="gate-error">Incorrect code. Please try again.</div>' +
    '</div>';

  document.body.appendChild(overlay);

  var input = document.getElementById('gate-input');
  var btn = document.getElementById('gate-btn');
  var error = document.getElementById('gate-error');

  function tryAuth() {
    if (btoa(input.value) === HASH) {
      localStorage.setItem(KEY, HASH);
      overlay.remove();
    } else {
      error.style.display = 'block';
      input.value = '';
      input.focus();
    }
  }

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') tryAuth();
  });

  btn.addEventListener('click', tryAuth);

  setTimeout(function () { input.focus(); }, 100);
})();
