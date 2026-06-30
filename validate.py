#!/usr/bin/env python3
"""
validate.py - Hard quality gate for MOXIE AI Insights monthly reports.

Reconstructed and committed 2026-06-30 (prior cycles ran an ephemeral, never-committed
version; this one lives in the repo so the gate stops disappearing between cycles).

Scans clients/<id>/<month>-<year>.html and fails the build if any report violates the
voice / paid-organic / recommends / word-band / uniqueness rules captured in project memory.

Usage:
    python3 validate.py [--month june-2026] [--strict]

Exit code 0 = clean, 1 = at least one failure. --strict also fails on warnings.

Inputs (committed alongside reports):
    data/june_inputs.json   per-client {name,status,audience,pills,has_june_paid,contextNotes}
    data/forward_look_overrides.json   forward_look + scope overrides
"""
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.abspath(__file__))

# ---- paid-framing vocabulary (only flagged for clients with NO active paid signal) ----
PAID_VOCAB = [
    r"paid side", r"paid channel", r"paid media", r"paid mix", r"paid presence",
    r"paid search", r"paid social", r"ad spend", r"ad budget", r"\bretargeting\b",
    r"\bremarketing\b", r"\bcampaigns?\b", r"\badvertis", r"\bboosted\b",
    r"cost per click", r"\bcpc\b", r"\bctr\b", r"click-through", r"impressions",
    r"google ads", r"facebook ads", r"linkedin ads", r"\bppc\b",
]
# ---- always-banned phrases / filler (memory: feedback_moxie_analysis_voice) ----
BANNED = [
    "paid presence", "we've got a sharp eye", "we'll keep building", "rock solid",
    "humming", "behind the scenes",
]
# ---- audience vocab that must NOT appear in B2B reports ----
B2B_FORBIDDEN = ["household", "shopper", "families", "family ", "foot traffic"]

# fixed UI strings that are NOT prose (skip when scanning for "your"/em-dash)
def prose_blocks(html):
    """Return (analysis_text, recommends_text). Prose only - excludes title/breadcrumb/labels."""
    analysis = ""
    m = re.search(r'<div class="summary-card">\s*<p>(.*?)</p>', html, re.S)
    if m: analysis = m.group(1)
    rec = ""
    # MOXIE Recommends card paragraph (opportunity-card or forward-look)
    mr = re.search(r'MOXIE Recommends.*?<(?:div class="opportunity-card"|div class="forward-look[^"]*")>.*?<p>(.*?)</p>', html, re.S)
    if mr: rec = mr.group(1)
    return analysis.strip(), rec.strip()

def recommends_title(html):
    mr = re.search(r'MOXIE Recommends.*?<h4>(.*?)</h4>', html, re.S)
    return mr.group(1).strip() if mr else ""

def sentences(text):
    t = re.sub(r'<[^>]+>', '', text)
    t = re.sub(r'\s+', ' ', t).strip()
    parts = re.split(r'(?<=[.!?])\s+', t)
    return [p.strip() for p in parts if p.strip()]

def wordcount(text):
    return len(re.sub(r'<[^>]+>', '', text).split())

def client_type(num, info, ov):
    pills = [p.lower() for p in info.get("pills", [])]
    if num in ov.get("forward_look", {}) and ov["forward_look"][num].get("angle") == "kickoff":
        return "kickoff"
    hosting_set = {"hosting", "website hosting", "website management", "website maintenance"}
    if pills and all(p in hosting_set for p in pills) and not info.get("has_june_paid"):
        return "hosting"
    return "full"

WORD_BANDS = {"full": (150, 220), "hosting": (90, 150), "kickoff": (120, 170)}

def main():
    month = "june-2026"
    strict = "--strict" in sys.argv
    for i, a in enumerate(sys.argv):
        if a == "--month" and i + 1 < len(sys.argv):
            month = sys.argv[i + 1]

    inputs = json.load(open(os.path.join(ROOT, "data", "june_inputs.json")))
    ov = json.load(open(os.path.join(ROOT, "data", "forward_look_overrides.json")))

    reports = sorted(glob.glob(os.path.join(ROOT, "clients", "*", f"{month}.html")))
    failures, warnings = [], []
    openers, closers = {}, {}

    for path in reports:
        num = path.split(os.sep)[-2]
        info = inputs.get(num, {"pills": [], "audience": "", "has_june_paid": False, "status": ""})
        html = open(path).read()
        analysis, rec = prose_blocks(html)
        if not analysis:
            failures.append(f"{num}: no MOXIE Analysis prose found")
            continue
        prose = analysis + " \n " + rec   # for always-banned checks (em-dash/your/filler)
        low = prose.lower()
        analysis_low = analysis.lower()    # paid-framing-leak is scanned on ANALYSIS ONLY
        ctype = client_type(num, info, ov)

        # 1. em-dash in prose
        if "—" in prose or "&mdash;" in prose:
            failures.append(f"{num}: em-dash in prose")
        # 2. "your" referring to client assets
        for m in re.finditer(r"\byour\b", low):
            failures.append(f"{num}: 'your' in prose -> ...{prose[max(0,m.start()-25):m.start()+10]}...")
            break
        # 3. banned filler
        for b in BANNED:
            if b in low:
                failures.append(f"{num}: banned phrase '{b}'")
        # 4. PAID_FRAMING_LEAK (organic clients only) - ANALYSIS prose only.
        #    The MOXIE Recommends card is ALLOWED to name a paid service (recommending one
        #    is the point); that path is gated by RECOMMENDS_OVERLAP, not here.
        paid_ok = info.get("has_june_paid") or (num in ov.get("scope", {}) and ov["scope"][num].get("allow_paid_framing"))
        scope = ov.get("scope", {}).get(num)
        if scope and scope.get("allow_paid_framing") is False:
            paid_ok = False
        if not paid_ok:
            for pat in PAID_VOCAB:
                m = re.search(pat, analysis_low)
                if m:
                    failures.append(f"{num}: PAID_FRAMING_LEAK '{m.group(0)}' (organic/website-only client)")
        # 5. recommends overlap
        rt = recommends_title(html)
        if rt.lower().startswith("add "):
            svc = rt[4:].strip().lower()
            pills_l = " | ".join(p.lower() for p in info.get("pills", []))
            # token overlap heuristic
            key = re.sub(r"\b(ads?|management|marketing)\b", "", svc).strip()
            if key and key in pills_l:
                failures.append(f"{num}: RECOMMENDS_OVERLAP '{rt}' overlaps active pill")
        # 6. word band
        lo, hi = WORD_BANDS[ctype]
        wc = wordcount(analysis)
        if wc < lo or wc > hi:
            (failures if (wc < lo - 20 or wc > hi + 25) else warnings).append(
                f"{num}: analysis {wc}w outside {ctype} band {lo}-{hi}")
        # 7. audience vocab
        if info.get("audience") == "B2B":
            for w in B2B_FORBIDDEN:
                if w in low:
                    warnings.append(f"{num}: B2B report uses '{w.strip()}'")
        # 8. uniqueness registry
        s = sentences(analysis)
        if s:
            openers.setdefault(s[0].lower(), []).append(num)
            closers.setdefault(s[-1].lower(), []).append(num)

    # dup openers / closers across the whole cohort
    for txt, nums in openers.items():
        if len(nums) > 1:
            failures.append(f"DUP_OPENER across {nums}: \"{txt[:60]}...\"")
    for txt, nums in closers.items():
        if len(nums) > 1:
            failures.append(f"DUP_CLOSER across {nums}: \"{txt[:60]}...\"")

    print(f"validate.py - {len(reports)} {month} reports scanned")
    print(f"  FAILURES: {len(failures)}   WARNINGS: {len(warnings)}")
    for f in failures: print("  FAIL ", f)
    for w in warnings: print("  warn ", w)
    bad = len(failures) + (len(warnings) if strict else 0)
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
