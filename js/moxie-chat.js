/* MOXIE Chat — Client Data Q&A Widget */
(function () {
  // Detect client number from URL
  var match = window.location.pathname.match(/\/clients\/(\d+)\//);
  if (!match) return;
  var clientNum = match[1];

  // Knowledge base
  var kb = { months: {}, services: [], clientName: '' };

  // Build the chat UI
  function buildUI() {
    // Floating button
    var btn = document.createElement('div');
    btn.className = 'moxie-chat-btn';
    btn.innerHTML = '<img src="/assets/moxie-mascot-xs.png" alt="Ask MOXIE">Ask MOXIE';
    btn.onclick = toggleChat;
    document.body.appendChild(btn);

    // Chat panel
    var panel = document.createElement('div');
    panel.className = 'moxie-chat-panel';
    panel.id = 'moxie-chat-panel';
    panel.style.display = 'none';
    panel.innerHTML =
      '<div class="moxie-chat-header">' +
        '<img src="/assets/moxie-mascot-xs.png" alt="MOXIE"><span>Ask MOXIE</span>' +
        '<button class="moxie-chat-close" onclick="document.getElementById(\'moxie-chat-panel\').style.display=\'none\'">&times;</button>' +
      '</div>' +
      '<div class="moxie-chat-messages" id="moxie-chat-messages">' +
        '<div class="moxie-msg bot">Hi! I\'m MOXIE. Ask me anything about your marketing data or how to use your dashboard. Try:<br><br>' +
        '<em>"What are my active services?"</em><br>' +
        '<em>"How many clicks did we get last month?"</em><br>' +
        '<em>"What did you do this month?"</em><br>' +
        '<em>"How do I give feedback on creative?"</em><br>' +
        '<em>"How do I message the team?"</em></div>' +
      '</div>' +
      '<div class="moxie-chat-input-bar">' +
        '<input type="text" id="moxie-chat-input" placeholder="Type your question..." autocomplete="off">' +
        '<button id="moxie-chat-send">&#10148;</button>' +
      '</div>';
    document.body.appendChild(panel);

    document.getElementById('moxie-chat-send').onclick = sendMessage;
    document.getElementById('moxie-chat-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendMessage();
    });
  }

  function toggleChat() {
    var panel = document.getElementById('moxie-chat-panel');
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    if (panel.style.display === 'flex') {
      document.getElementById('moxie-chat-input').focus();
    }
  }

  function addMessage(text, isBot) {
    var msgs = document.getElementById('moxie-chat-messages');
    var div = document.createElement('div');
    div.className = 'moxie-msg ' + (isBot ? 'bot' : 'user');
    div.innerHTML = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function sendMessage() {
    var input = document.getElementById('moxie-chat-input');
    var q = input.value.trim();
    if (!q) return;
    addMessage(q, false);
    input.value = '';
    var answer = getAnswer(q);
    setTimeout(function () { addMessage(answer, true); }, 300);
  }

  // Extract data from a report HTML string
  function parseReport(html, monthName) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var data = { month: monthName, metrics: {}, platforms: {}, services: [], activities: [], analysis: '', recommendation: '' };

    // Performance metrics
    doc.querySelectorAll('.perf-card').forEach(function (card) {
      var label = (card.querySelector('.perf-label') || {}).textContent || '';
      var value = (card.querySelector('.perf-value') || {}).textContent || '';
      var trend = (card.querySelector('.perf-trend') || {}).textContent || '';
      if (label && value) data.metrics[label.trim()] = { value: value.trim(), trend: trend.trim() };
    });

    // Platform breakdown
    doc.querySelectorAll('.platform-card').forEach(function (card) {
      var header = (card.querySelector('.platform-header') || {}).textContent || '';
      var pName = header.replace(/^[A-Z]{1,3}\s*/, '').trim();
      var pMetrics = {};
      card.querySelectorAll('.metric-row').forEach(function (row) {
        var lbl = (row.querySelector('.metric-label') || row.querySelector('span:first-child') || {}).textContent || '';
        var val = (row.querySelector('.metric-value') || row.querySelector('strong') || {}).textContent || '';
        if (lbl && val) pMetrics[lbl.trim()] = val.trim();
      });
      if (pName) data.platforms[pName] = pMetrics;
    });

    // Services
    doc.querySelectorAll('.service-pill').forEach(function (pill) {
      data.services.push(pill.textContent.trim());
    });

    // Activities
    doc.querySelectorAll('.activity-list li').forEach(function (li) {
      var text = li.textContent.replace(/[●•]\s*/, '').trim();
      if (text && text !== 'Standard monthly service delivery') data.activities.push(text);
    });

    // Analysis
    var summary = doc.querySelector('.summary-card p');
    if (summary) data.analysis = summary.textContent.trim();

    // Recommendation
    var opp = doc.querySelector('.opportunity-card');
    if (opp) {
      var title = (opp.querySelector('h4') || {}).textContent || '';
      var desc = (opp.querySelector('p') || {}).textContent || '';
      data.recommendation = title + ': ' + desc;
    }

    return data;
  }

  // Load all reports — discovers whichever months exist by scraping the
  // report links off the client's dashboard index (works from any page).
  var MONTH_ORDER = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  function monthSortKey(label) {
    // "June 2026" -> 202606
    var parts = label.toLowerCase().split(' ');
    var mi = MONTH_ORDER.indexOf(parts[0]);
    var yr = parseInt(parts[1], 10) || 0;
    return yr * 100 + (mi + 1);
  }

  function loadReport(slug, label) {
    fetch('/clients/' + clientNum + '/' + slug + '.html')
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) {
        if (html) {
          kb.months[label] = parseReport(html, label);
          kb.months[label].services.forEach(function (s) {
            if (kb.services.indexOf(s) === -1) kb.services.push(s);
          });
        }
      })
      .catch(function () {});
  }

  function loadData() {
    // Get client name from page
    var nameEl = document.querySelector('.client-name');
    if (nameEl) kb.clientName = nameEl.textContent.trim();

    // Get services from current page
    document.querySelectorAll('.service-pill').forEach(function (pill) {
      var s = pill.textContent.trim();
      if (kb.services.indexOf(s) === -1) kb.services.push(s);
    });

    fetch('/clients/' + clientNum + '/index.html')
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) {
        if (!html) return;
        var re = new RegExp('/clients/' + clientNum + '/([a-z]+-[0-9]{4})', 'g');
        var seen = {};
        var m;
        while ((m = re.exec(html)) !== null) {
          var slug = m[1];
          var word = slug.split('-')[0];
          if (MONTH_ORDER.indexOf(word) === -1 || seen[slug]) continue;
          seen[slug] = true;
          var label = word.charAt(0).toUpperCase() + word.slice(1) + ' ' + slug.split('-')[1];
          loadReport(slug, label);
        }
      })
      .catch(function () {});
  }

  // ── Portal feature knowledge (how-to answers) ─────────────────────
  var FEATURES = [
    {
      kws: ['message meg', 'message the team', 'contact you', 'contact the team', 'reach you', 'get ahold', 'get a hold', 'send a message', 'talk to the team', 'talk to you'],
      a: 'Use the <strong>Message Meg</strong> button in the top-right corner of your dashboard! It opens a chat where you can send a note straight to the team — your whole conversation history is saved there, and a red dot appears when we\'ve replied.'
    },
    {
      kws: ['thumbs', 'thumb up', 'thumb down', 'give feedback', 'feedback on creative', 'vote on', 'like an option', 'which option'],
      a: 'Every card in your <strong>Current Work</strong> section has 👍 and 👎 buttons — one click tells us which options you love (or don\'t). You can also click <strong>Comment</strong> on any card to send us a note about that specific piece. Everything reaches the team instantly.'
    },
    {
      kws: ['comment on', 'leave a comment', 'leave a note', 'add a comment'],
      a: 'Click the <strong>Comment</strong> button on any Current Work card, type your note, and hit <strong>Send to the Team</strong>. Your sent comments stay visible under the card, and our team gets an alert right away.'
    },
    {
      kws: ['star rating', 'rate you', 'rate the team', 'how do i rate', 'satisfaction', 'stars mean', 'give you stars'],
      a: 'Scroll to the <strong>How Are We Doing?</strong> card at the bottom of your dashboard (or tap the button with the gold star at the top right) and click 1–5 stars. It goes straight to us — and if we\'re not hitting the mark, there\'s a box to tell us what we could do better.'
    },
    {
      kws: ['current work', 'creative options', 'what are you building', 'see the creative', 'see your work'],
      a: 'The <strong>Current Work</strong> section on your dashboard shows exactly what our team is creating for you right now — ad creative, social posts, videos, and more, organized under headings with notes on each piece. Give any of it a 👍/👎 or a comment!'
    },
    {
      kws: ['dropbox', 'my files', 'download files', 'shared files'],
      a: 'The <strong>Dropbox</strong> button at the top right of your dashboard opens your shared folder with all your files and creative assets.'
    },
    {
      kws: ['meet with meg', 'meet w/ meg', 'schedule a meeting', 'book a meeting', 'calendly', 'schedule a call', 'book a call', 'set up a meeting'],
      a: 'Click <strong>Meet w/ Meg</strong> at the top right of your dashboard — it opens Meg\'s calendar so you can pick a time that works for you.'
    },
    {
      kws: ['pin', 'access code', 'password', 'log in', 'login', 'sign in', 'locked out'],
      a: 'Your dashboard is protected by a private PIN. Enter your client number and access code on the sign-in page. If you\'ve misplaced your PIN, just reach out to the team (Message Meg works great for that once you\'re in, or email us).'
    },
    {
      kws: ['project tracker', 'website build', 'project status', 'track my project', 'build progress'],
      a: 'When we\'re building something big for you — like a new website — a <strong>Project Tracker</strong> appears on your dashboard showing every step, what\'s complete, and what\'s in progress, plus preview links when they\'re ready.'
    },
    {
      kws: ['how it works', 'explainer', 'overview video', 'watch the video', 'tutorial'],
      a: 'Click <strong>How it works in 60 seconds</strong> near the top of your dashboard for a quick video tour of everything in here.'
    },
    {
      kws: ['monthly report', 'see my report', 'open a report', 'past reports', 'old reports'],
      a: 'Your <strong>Monthly Reports</strong> grid is right on your dashboard — one card per month. Each report has your performance numbers, platform breakdowns, what we did that month, and MOXIE\'s plain-English analysis.'
    },
    {
      kws: ['what can you do', 'help', 'what do you know', 'how does this work', 'what is this'],
      a: 'I can answer questions about your <strong>marketing data</strong> (impressions, clicks, sessions, spend, any platform, any month) and about <strong>using your dashboard</strong> — Current Work feedback with 👍/👎 and comments, Message Meg chat, the How Are We Doing star rating, Dropbox files, booking time with Meg, project trackers, and your monthly reports. Ask away!'
    }
  ];

  // Answer engine
  function getAnswer(question) {
    var q = question.toLowerCase();

    // Portal how-to questions work even before report data loads.
    // Word-boundary matching so short keywords (e.g. "pin") don't fire
    // inside other words (e.g. "shopping").
    for (var fi = 0; fi < FEATURES.length; fi++) {
      for (var ki = 0; ki < FEATURES[fi].kws.length; ki++) {
        var kw = FEATURES[fi].kws[ki].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp('\\b' + kw + '\\b').test(q)) return FEATURES[fi].a;
      }
    }

    var monthKeys = Object.keys(kb.months);
    if (monthKeys.length === 0) {
      return "I'm still loading your report data. Please try again in a moment.";
    }

    // Newest first
    monthKeys.sort(function (a, b) { return monthSortKey(b) - monthSortKey(a); });

    // Detect month filter — any month name, with optional year
    var targetMonth = null;
    var qYear = (q.match(/20\d{2}/) || [null])[0];
    for (var mi = 0; mi < MONTH_ORDER.length; mi++) {
      var word = MONTH_ORDER[mi];
      if (new RegExp('\\b' + word + '\\b').test(q) || new RegExp('\\b' + word.slice(0, 3) + '\\b').test(q)) {
        // Candidates for this month word, newest first; prefer a year match
        for (var k = 0; k < monthKeys.length; k++) {
          var key = monthKeys[k];
          if (key.toLowerCase().indexOf(word) === 0) {
            if (!qYear || key.indexOf(qYear) > -1) { targetMonth = key; break; }
            if (!targetMonth) targetMonth = key;
          }
        }
        if (targetMonth) break;
      }
    }
    if (!targetMonth && q.indexOf('last month') > -1 && monthKeys.length > 1) targetMonth = monthKeys[0];
    if (!targetMonth && q.indexOf('this month') > -1) targetMonth = monthKeys[0];

    // Without a month filter, focus answers on the 3 most recent months
    var relevantMonths = targetMonth ? [targetMonth] : monthKeys.slice(0, 3);

    // Services question
    if (q.indexOf('service') > -1 || q.indexOf('block') > -1 || q.indexOf('what do we') > -1 || q.indexOf('what are we') > -1 || q.indexOf('what do you do') > -1) {
      if (kb.services.length > 0) {
        return 'Your active marketing services are: <strong>' + kb.services.join('</strong>, <strong>') + '</strong>.';
      }
      return "I don't see any active service blocks in your reports.";
    }

    // Activities / what did you do
    if (q.indexOf('activit') > -1 || q.indexOf('what did') > -1 || q.indexOf('work') > -1 || q.indexOf('done') > -1 || q.indexOf('did this month') > -1 || q.indexOf('did you do') > -1) {
      var acts = [];
      relevantMonths.forEach(function (m) {
        var d = kb.months[m];
        if (d && d.activities.length > 0) {
          // Filter out service block names
          var real = d.activities.filter(function (a) { return kb.services.indexOf(a) === -1; });
          if (real.length > 0) acts.push('<strong>' + m + ':</strong><br>• ' + real.join('<br>• '));
        }
      });
      if (acts.length > 0) return acts.join('<br><br>');
      return "I don't have specific activity details for the requested period.";
    }

    // Recommendation
    if (q.indexOf('recommend') > -1 || q.indexOf('suggest') > -1 || q.indexOf('opportunit') > -1 || q.indexOf('should we') > -1 || q.indexOf('what next') > -1) {
      var recs = [];
      relevantMonths.forEach(function (m) {
        var d = kb.months[m];
        if (d && d.recommendation) recs.push('<strong>' + m + ':</strong> ' + d.recommendation);
      });
      if (recs.length > 0) return recs.join('<br><br>');
      return "I don't have specific recommendations in your reports right now.";
    }

    // Analysis / how are we doing / summary
    if (q.indexOf('analysis') > -1 || q.indexOf('summary') > -1 || q.indexOf('how are we') > -1 || q.indexOf('how am i') > -1 || q.indexOf('overview') > -1 || q.indexOf('doing') > -1 || q.indexOf('performance') > -1) {
      var analyses = [];
      relevantMonths.forEach(function (m) {
        var d = kb.months[m];
        if (d && d.analysis) analyses.push('<strong>' + m + ':</strong> ' + d.analysis);
      });
      if (analyses.length > 0) return analyses.join('<br><br>');
      return "I don't have a performance summary for the requested period.";
    }

    // Platform-specific questions
    var platformKeywords = {
      'facebook': 'Facebook', 'meta': 'Facebook', 'fb': 'Facebook',
      'google': 'Google', 'search ads': 'Google Search', 'pmax': 'Google P-Max', 'p-max': 'Google P-Max', 'shopping': 'Google Shopping', 'display': 'Google Display', 'remarketing': 'Google Remarketing',
      'linkedin': 'LinkedIn', 'li ads': 'LinkedIn',
      'tiktok': 'TikTok', 'tik tok': 'TikTok',
      'microsoft': 'Microsoft', 'bing': 'Microsoft',
      'youtube': 'YouTube', 'yt': 'YouTube',
      'billboard': 'Digital Billboard', 'billboards': 'Digital Billboard',
      'email': 'Email', 'newsletter': 'Email',
      'social media': 'Social Media', 'social post': 'Social Media',
      'website traffic': 'Website Traffic', 'web traffic': 'Website Traffic',
      'adroll': 'AdRoll', 'remarketing': 'Remarketing'
    };

    var matchedPlatform = null;
    Object.keys(platformKeywords).forEach(function (kw) {
      if (q.indexOf(kw) > -1) matchedPlatform = platformKeywords[kw];
    });

    if (matchedPlatform) {
      var platResults = [];
      relevantMonths.forEach(function (m) {
        var d = kb.months[m];
        if (!d) return;
        Object.keys(d.platforms).forEach(function (pName) {
          if (pName.toLowerCase().indexOf(matchedPlatform.toLowerCase()) > -1) {
            var metrics = d.platforms[pName];
            var lines = Object.keys(metrics).map(function (k) { return k + ': <strong>' + metrics[k] + '</strong>'; });
            platResults.push('<strong>' + m + ' — ' + pName + '</strong><br>' + lines.join('<br>'));
          }
        });
      });
      if (platResults.length > 0) return platResults.join('<br><br>');
      return "I don't have " + matchedPlatform + " data in your reports.";
    }

    // Metric-specific questions
    var metricKeywords = {
      'impression': 'Impressions', 'click': 'Clicks', 'spend': 'Spend',
      'budget': 'Budget', 'session': 'Sessions', 'traffic': 'Sessions',
      'ctr': 'CTR', 'click-through': 'CTR', 'click through': 'CTR',
      'reach': 'Reach', 'like': 'Likes', 'view': 'Views',
      'open': 'Opens', 'sent': 'Sent To', 'blip': 'Blips',
      'cost': 'Spend'
    };

    var matchedMetric = null;
    Object.keys(metricKeywords).forEach(function (kw) {
      if (q.indexOf(kw) > -1) matchedMetric = metricKeywords[kw];
    });

    if (matchedMetric) {
      var metricResults = [];
      relevantMonths.forEach(function (m) {
        var d = kb.months[m];
        if (!d) return;

        // Check perf metrics
        Object.keys(d.metrics).forEach(function (label) {
          if (label.toLowerCase().indexOf(matchedMetric.toLowerCase()) > -1) {
            var info = d.metrics[label];
            var line = '<strong>' + m + '</strong> — ' + label + ': <strong>' + info.value + '</strong>';
            if (info.trend) line += ' (' + info.trend + ')';
            metricResults.push(line);
          }
        });

        // Check platform metrics
        Object.keys(d.platforms).forEach(function (pName) {
          var pm = d.platforms[pName];
          Object.keys(pm).forEach(function (mk) {
            if (mk.toLowerCase().indexOf(matchedMetric.toLowerCase()) > -1) {
              metricResults.push('<strong>' + m + '</strong> — ' + pName + ' ' + mk + ': <strong>' + pm[mk] + '</strong>');
            }
          });
        });
      });

      // Deduplicate
      var unique = [];
      metricResults.forEach(function (r) { if (unique.indexOf(r) === -1) unique.push(r); });

      if (unique.length > 0) return unique.join('<br>');
      return "I don't have " + matchedMetric.toLowerCase() + " data in your reports.";
    }

    // Fallback
    return "I can answer questions about your marketing data and your dashboard. Try asking about:<br>• <em>Your active services</em><br>• <em>Impressions, clicks, or spend</em><br>• <em>A specific platform (Google, Facebook, TikTok, etc.)</em><br>• <em>What we did this month</em><br>• <em>How to give feedback on creative (thumbs &amp; comments)</em><br>• <em>How to message the team or book time with Meg</em><br>• <em>The star rating, Dropbox, or project trackers</em>";
  }

  // Initialize
  buildUI();
  loadData();
})();
