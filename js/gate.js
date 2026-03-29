/* MOXIE AI Insights — Password Gate */
(function () {
  var KEY = 'moxie_auth';
  var HASH = 'ODY3NQ=='; // base64 of "8675"

  if (sessionStorage.getItem(KEY) === HASH) return;

  // Build overlay
  var overlay = document.createElement('div');
  overlay.className = 'gate-overlay';
  overlay.innerHTML =
    '<div class="gate-box">' +
      '<h1>MOXIE AI Insights</h1>' +
      '<p>Enter your access code to continue</p>' +
      '<input type="password" id="gate-input" placeholder="Access Code" maxlength="10" autocomplete="off">' +
      '<div class="gate-error" id="gate-error">Incorrect code. Please try again.</div>' +
    '</div>';

  document.body.appendChild(overlay);

  var input = document.getElementById('gate-input');
  var error = document.getElementById('gate-error');

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      if (btoa(input.value) === HASH) {
        sessionStorage.setItem(KEY, HASH);
        overlay.remove();
      } else {
        error.style.display = 'block';
        input.value = '';
        input.focus();
      }
    }
  });

  setTimeout(function () { input.focus(); }, 100);
})();
