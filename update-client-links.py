#!/usr/bin/env python3
"""
Update client dashboard links — Dropbox, Legacy Reports, Meet w/ Meg
Run: python3 update-client-links.py [--dry-run]
"""
import json, re, os, glob, sys, difflib, builtins

BASE = os.path.dirname(os.path.abspath(__file__))

DRY_RUN = False

def _enable_dry_run_prefix():
    _real_print = builtins.print
    def _dry_print(*args, **kwargs):
        _real_print("[DRY RUN]", *args, **kwargs)
    builtins.print = _dry_print

def write_file(path, new_content):
    if DRY_RUN:
        try:
            with open(path) as _f:
                old = _f.read()
        except FileNotFoundError:
            old = ""
        print(f"WOULD WRITE: {path}")
        diff = difflib.unified_diff(
            old.splitlines(keepends=True),
            new_content.splitlines(keepends=True),
            fromfile=path + " (current)",
            tofile=path + " (new)",
        )
        for line in diff:
            print(line.rstrip("\n"))
        return
    with open(path, 'w') as f:
        f.write(new_content)

DB_SVG = '<svg width="16" height="16" viewBox="0 0 43 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0L0 8.1l8.7 7 12.8-8.1L12.5 0zM0 22.1l12.5 8.1 9-7-12.8-8.1L0 22.1zM21.5 23.2l9 7 12.5-8.1-8.7-7-12.8 8.1zM43 8.1L30.5 0l-9 7 12.8 8.1L43 8.1zM21.5 25l-9 7.1-3.5-2.3v2.6l12.5 7.5 12.5-7.5v-2.6l-3.5 2.3-9-7.1z" fill="#fff"/></svg>'
CHART_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D80DE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></svg>'
MEG_BTN = '<a href="https://calendly.com/walkermeg" target="_blank" rel="noopener noreferrer" style="background:#fff;color:#1D80DE;padding:12px 22px;border-radius:10px;font-size:1rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:10px;width:100%;justify-content:center;box-sizing:border-box;border:2px solid #1D80DE;"><img src="/assets/meg-headshot.png" alt="Meg" style="width:32px;height:32px;border-radius:50%;"> Meet w/ Meg</a>'

def load_clients():
    with open(os.path.join(BASE, 'data', 'clients.json')) as f:
        return json.load(f)

def get_current_links(filepath):
    """Extract current Dropbox and Legacy links from a dashboard file"""
    with open(filepath) as f:
        content = f.read()

    dropbox = ''
    legacy = ''
    has_meg = 'calendly' in content

    db_match = re.search(r'href="(https://www\.dropbox\.com/[^"]+)"', content)
    if db_match:
        dropbox = db_match.group(1)

    lr_match = re.search(r'href="(https://docs\.google\.com/spreadsheets/[^"]+)"', content)
    if lr_match:
        legacy = lr_match.group(1)

    return dropbox, legacy, has_meg

def build_buttons(dropbox, legacy):
    """Build the full button container HTML"""
    btns = [MEG_BTN]

    if dropbox:
        btns.append(f'<a href="{dropbox}" target="_blank" rel="noopener noreferrer" style="background:#0061FE;color:#fff;padding:8px 14px;border-radius:8px;font-size:0.8rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;width:100%;justify-content:center;box-sizing:border-box;">{DB_SVG} Dropbox</a>')

    if legacy:
        btns.append(f'<a href="{legacy}" target="_blank" rel="noopener noreferrer" style="background:#fff;color:#1D80DE;padding:8px 14px;border-radius:8px;font-size:0.8rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;border:2px solid #1D80DE;width:100%;justify-content:center;box-sizing:border-box;">{CHART_SVG} Legacy Reports</a>')

    return '<div style="position:absolute;top:16px;right:0;display:flex;flex-direction:column;gap:8px;align-items:flex-end;">' + ''.join(btns) + '</div>'

def update_dashboard(filepath, dropbox, legacy):
    """Update a dashboard file with new button links"""
    with open(filepath) as f:
        content = f.read()

    # Remove existing button container
    content = re.sub(
        r'<div style="position:absolute;top:16px;right:0;display:flex;flex-direction:column;gap:8px;align-items:flex-end;">.*?</div>',
        '', content, flags=re.DOTALL
    )

    new_buttons = build_buttons(dropbox, legacy)

    # Ensure position:relative on header
    if 'dashboard-header">' in content and 'position:relative' not in content:
        content = content.replace('dashboard-header">', 'dashboard-header" style="position:relative;">')

    # Insert new buttons
    content = re.sub(
        r'(<div class="dashboard-header" style="position:relative;">)',
        r'\1\n      ' + new_buttons,
        content
    )

    write_file(filepath, content)

def update_admin(num, dropbox, legacy):
    """Update admin dashboard clientLinks"""
    admin_path = os.path.join(BASE, 'admin', 'index.html')
    if not os.path.exists(admin_path):
        return

    with open(admin_path) as f:
        content = f.read()

    # Build the new entry
    parts = []
    if dropbox:
        parts.append(f'dropbox:"{dropbox}"')
    if legacy:
        parts.append(f'legacy:"{legacy}"')

    new_entry = f'          "{num}": {{{",".join(parts)}}}'

    # Check if entry exists
    pattern = rf'          "{num}": \{{[^}}]*\}}'
    if re.search(pattern, content):
        # Update existing
        content = re.sub(pattern, new_entry, content)
    elif parts:
        # Add new entry
        content = content.replace(
            'var clientLinks = {\n',
            f'var clientLinks = {{\n{new_entry},\n'
        )

    write_file(admin_path, content)

def main():
    global DRY_RUN
    if '--dry-run' in sys.argv:
        DRY_RUN = True
        sys.argv = [a for a in sys.argv if a != '--dry-run']
        _enable_dry_run_prefix()

    clients = load_clients()

    print("\n  ╔══════════════════════════════════════╗")
    print("  ║   MOXIE — Update Client Links        ║")
    print("  ╚══════════════════════════════════════╝\n")

    # Get client number
    num = input("  Client Number (7 digits): ").strip()

    if num not in clients:
        print(f"\n  ❌ Client {num} not found in clients.json")
        print("  Available clients:")
        for n, info in sorted(clients.items()):
            print(f"    {n}  {info['name']}")
        return

    name = clients[num]['name']
    filepath = os.path.join(BASE, 'clients', num, 'index.html')

    if not os.path.exists(filepath):
        print(f"\n  ❌ Dashboard not found: clients/{num}/index.html")
        return

    # Show current state
    cur_db, cur_lr, has_meg = get_current_links(filepath)

    print(f"\n  Client: {name} (#{num})")
    print(f"  ─────────────────────────────────────")
    print(f"  Meet w/ Meg:    {'✅ Active' if has_meg else '❌ Missing'}")
    print(f"  Dropbox:        {cur_db[:60] + '...' if cur_db else '❌ Not set'}")
    print(f"  Legacy Reports: {cur_lr[:60] + '...' if cur_lr else '❌ Not set'}")
    print()

    # Ask what to update
    print("  What do you want to update?")
    print("  1) Dropbox link")
    print("  2) Legacy Reports link")
    print("  3) Both")
    print("  4) Remove Dropbox link")
    print("  5) Remove Legacy Reports link")
    print("  6) Cancel")

    choice = input("\n  Choice (1-6): ").strip()

    new_db = cur_db
    new_lr = cur_lr

    if choice == '1' or choice == '3':
        new_db = input("  Dropbox URL: ").strip()
    if choice == '2' or choice == '3':
        new_lr = input("  Legacy Reports URL: ").strip()
    if choice == '4':
        new_db = ''
        print("  Dropbox link will be removed.")
    if choice == '5':
        new_lr = ''
        print("  Legacy Reports link will be removed.")
    if choice == '6':
        print("  Cancelled.")
        return

    # Apply changes
    update_dashboard(filepath, new_db, new_lr)
    update_admin(num, new_db, new_lr)

    print(f"\n  ✅ Updated {name} (#{num})")
    print(f"  Meet w/ Meg:    ✅ Active")
    print(f"  Dropbox:        {'✅ ' + new_db[:50] + '...' if new_db else '—'}")
    print(f"  Legacy Reports: {'✅ ' + new_lr[:50] + '...' if new_lr else '—'}")
    print(f"\n  Deploy with: npx netlify deploy --dir=. --prod")
    print()

if __name__ == '__main__':
    main()
