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
        '<div class="moxie-msg bot">Hi! I\'m MOXIE. Ask me anything about your marketing data, services, or activities. Try questions like:<br><br>' +
        '<em>"What are my active services?"</em><br>' +
        '<em>"How many clicks did we get in March?"</em><br>' +
        '<em>"What did you do this month?"</em><br>' +
        '<em>"How are we doing?"</em></div>' +
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

  // Load all reports
  function loadData() {
    var months = ['january-2026', 'february-2026', 'march-2026'];
    var monthNames = ['January 2026', 'February 2026', 'March 2026'];

    // Get client name from page
    var nameEl = document.querySelector('.client-name');
    if (nameEl) kb.clientName = nameEl.textContent.trim();

    // Get services from current page
    document.querySelectorAll('.service-pill').forEach(function (pill) {
      var s = pill.textContent.trim();
      if (kb.services.indexOf(s) === -1) kb.services.push(s);
    });

    months.forEach(function (m, i) {
      fetch('/clients/' + clientNum + '/' + m + '.html')
        .then(function (r) { return r.ok ? r.text() : null; })
        .then(function (html) {
          if (html) {
            kb.months[monthNames[i]] = parseReport(html, monthNames[i]);
            // Merge services
            kb.months[monthNames[i]].services.forEach(function (s) {
              if (kb.services.indexOf(s) === -1) kb.services.push(s);
            });
          }
        })
        .catch(function () {});
    });
  }

  // Answer engine
  function getAnswer(question) {
    var q = question.toLowerCase();
    var monthKeys = Object.keys(kb.months);
    if (monthKeys.length === 0) {
      return "I'm still loading your report data. Please try again in a moment.";
    }

    // Detect month filter
    var targetMonth = null;
    if (q.indexOf('january') > -1 || q.indexOf('jan') > -1) targetMonth = 'January 2026';
    if (q.indexOf('february') > -1 || q.indexOf('feb') > -1) targetMonth = 'February 2026';
    if (q.indexOf('march') > -1 || q.indexOf('mar ') > -1 || q.indexOf('march') > -1) targetMonth = 'March 2026';

    var relevantMonths = targetMonth ? [targetMonth] : monthKeys;

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
    return "I can only answer questions about your marketing data. Try asking about:<br>• <em>Your active services</em><br>• <em>Impressions, clicks, or spend</em><br>• <em>A specific platform (Google, Facebook, etc.)</em><br>• <em>What we did this month</em><br>• <em>How are we doing?</em>";
  }

  // Initialize
  buildUI();
  loadData();
})();
