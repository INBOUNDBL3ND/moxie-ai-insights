#!/usr/bin/env python3
"""
MOXIE Admin — Client Management Tool
Run: python3 moxie-admin.py [--dry-run]
"""
import json, re, os, glob, shutil, html as htmlmod, sys, difflib, builtins

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

def remove_tree(path):
    if DRY_RUN:
        print(f"WOULD REMOVE DIR: {path}")
        return
    shutil.rmtree(path)

DB_SVG = '<svg width="16" height="16" viewBox="0 0 43 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0L0 8.1l8.7 7 12.8-8.1L12.5 0zM0 22.1l12.5 8.1 9-7-12.8-8.1L0 22.1zM21.5 23.2l9 7 12.5-8.1-8.7-7-12.8 8.1zM43 8.1L30.5 0l-9 7 12.8 8.1L43 8.1zM21.5 25l-9 7.1-3.5-2.3v2.6l12.5 7.5 12.5-7.5v-2.6l-3.5 2.3-9-7.1z" fill="#fff"/></svg>'
CHART_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D80DE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></svg>'
MEG_BTN = '<a href="https://calendly.com/walkermeg" target="_blank" rel="noopener noreferrer" style="background:#fff;color:#1D80DE;padding:12px 22px;border-radius:10px;font-size:1rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:10px;width:100%;justify-content:center;box-sizing:border-box;border:2px solid #1D80DE;"><img src="/assets/meg-headshot.png" alt="Meg" style="width:32px;height:32px;border-radius:50%;"> Meet w/ Meg</a>'

def load_clients():
    with open(os.path.join(BASE, 'data', 'clients.json')) as f:
        return json.load(f)

def save_clients(clients):
    clients = dict(sorted(clients.items()))
    write_file(os.path.join(BASE, 'data', 'clients.json'),
               json.dumps(clients, indent=2))

def get_current_links(filepath):
    with open(filepath) as f:
        content = f.read()
    dropbox = ''
    legacy = ''
    has_meg = 'calendly' in content
    db_match = re.search(r'href="(https://www\.dropbox\.com/[^"]+)"', content)
    if db_match: dropbox = db_match.group(1)
    lr_match = re.search(r'href="(https://docs\.google\.com/spreadsheets/[^"]+)"', content)
    if lr_match: legacy = lr_match.group(1)
    return dropbox, legacy, has_meg

def build_buttons(dropbox, legacy):
    btns = [MEG_BTN]
    if dropbox:
        btns.append(f'<a href="{dropbox}" target="_blank" rel="noopener noreferrer" style="background:#0061FE;color:#fff;padding:8px 14px;border-radius:8px;font-size:0.8rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;width:100%;justify-content:center;box-sizing:border-box;">{DB_SVG} Dropbox</a>')
    if legacy:
        btns.append(f'<a href="{legacy}" target="_blank" rel="noopener noreferrer" style="background:#fff;color:#1D80DE;padding:8px 14px;border-radius:8px;font-size:0.8rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;border:2px solid #1D80DE;width:100%;justify-content:center;box-sizing:border-box;">{CHART_SVG} Legacy Reports</a>')
    return '<div style="position:absolute;top:16px;right:0;display:flex;flex-direction:column;gap:8px;align-items:flex-end;">' + ''.join(btns) + '</div>'

def update_dashboard(filepath, dropbox, legacy):
    with open(filepath) as f:
        content = f.read()
    content = re.sub(
        r'<div style="position:absolute;top:16px;right:0;display:flex;flex-direction:column;gap:8px;align-items:flex-end;">.*?</div>',
        '', content, flags=re.DOTALL
    )
    new_buttons = build_buttons(dropbox, legacy)
    if 'dashboard-header">' in content and 'position:relative' not in content:
        content = content.replace('dashboard-header">', 'dashboard-header" style="position:relative;">')
    content = re.sub(
        r'(<div class="dashboard-header" style="position:relative;">)',
        r'\1\n      ' + new_buttons,
        content
    )
    write_file(filepath, content)

def update_admin_links(num, dropbox, legacy):
    admin_path = os.path.join(BASE, 'admin', 'index.html')
    if not os.path.exists(admin_path): return
    with open(admin_path) as f:
        content = f.read()
    parts = []
    if dropbox: parts.append(f'dropbox:"{dropbox}"')
    if legacy: parts.append(f'legacy:"{legacy}"')
    new_entry = f'          "{num}": {{{",".join(parts)}}}'
    pattern = rf'          "{num}": \{{[^}}]*\}},?\n?'
    if re.search(pattern, content):
        if parts:
            content = re.sub(pattern, new_entry + ',\n', content)
        else:
            content = re.sub(pattern, '', content)
    elif parts:
        content = content.replace('var clientLinks = {\n', f'var clientLinks = {{\n{new_entry},\n')
    write_file(admin_path, content)

def remove_from_admin_links(num):
    admin_path = os.path.join(BASE, 'admin', 'index.html')
    if not os.path.exists(admin_path): return
    with open(admin_path) as f:
        content = f.read()
    pattern = rf'          "{num}": \{{[^}}]*\}},?\n?'
    content = re.sub(pattern, '', content)
    write_file(admin_path, content)

def header():
    print("\n  ╔══════════════════════════════════════════╗")
    print("  ║       🤖 MOXIE Admin — Client Manager    ║")
    print("  ╚══════════════════════════════════════════╝\n")

def list_clients(clients):
    print(f"  {'#':<10} {'Client Name':<40} {'Reports'}")
    print(f"  {'─'*10} {'─'*40} {'─'*10}")
    for num in sorted(clients.keys()):
        name = clients[num]['name']
        cdir = os.path.join(BASE, 'clients', num)
        reports = len(glob.glob(os.path.join(cdir, '*-2026.html'))) if os.path.exists(cdir) else 0
        print(f"  {num:<10} {name:<40} {reports}")
    print(f"\n  Total: {len(clients)} clients\n")

def view_client(clients, num):
    name = clients[num]['name']
    cdir = os.path.join(BASE, 'clients', num)
    filepath = os.path.join(cdir, 'index.html')

    print(f"\n  ┌──────────────────────────────────────────┐")
    print(f"  │  {name} (#{num})")
    print(f"  └──────────────────────────────────────────┘")

    if os.path.exists(filepath):
        db, lr, meg = get_current_links(filepath)
        print(f"  Meet w/ Meg:     {'✅ Active' if meg else '❌ Missing'}")
        print(f"  Dropbox:         {db[:55] + '...' if db else '—  Not set'}")
        print(f"  Legacy Reports:  {lr[:55] + '...' if lr else '—  Not set'}")
    else:
        print(f"  ⚠️  No dashboard found at clients/{num}/index.html")

    reports = sorted(glob.glob(os.path.join(cdir, '*-2026.html')))
    if reports:
        print(f"\n  Reports:")
        for r in reports:
            print(f"    📄 {os.path.basename(r)}")
    else:
        print(f"\n  Reports: None")
    print()

def edit_links(clients, num):
    name = clients[num]['name']
    filepath = os.path.join(BASE, 'clients', num, 'index.html')

    if not os.path.exists(filepath):
        print(f"\n  ❌ No dashboard found for {name}")
        return

    db, lr, meg = get_current_links(filepath)

    print(f"\n  Editing links for {name} (#{num})")
    print(f"  ─────────────────────────────────────────")
    print(f"  Current Dropbox:         {db[:55] + '...' if db else '—'}")
    print(f"  Current Legacy Reports:  {lr[:55] + '...' if lr else '—'}")
    print()
    print("  Options:")
    print("  1) Set/Change Dropbox link")
    print("  2) Set/Change Legacy Reports link")
    print("  3) Set/Change both")
    print("  4) Remove Dropbox link")
    print("  5) Remove Legacy Reports link")
    print("  6) Remove both links")
    print("  7) Cancel")

    choice = input("\n  Choice: ").strip()

    new_db = db
    new_lr = lr

    if choice in ('1', '3'):
        new_db = input("  Dropbox URL: ").strip()
        if not new_db:
            print("  Skipped — keeping current.")
            new_db = db
    if choice in ('2', '3'):
        new_lr = input("  Legacy Reports URL: ").strip()
        if not new_lr:
            print("  Skipped — keeping current.")
            new_lr = lr
    if choice == '4':
        new_db = ''
    if choice == '5':
        new_lr = ''
    if choice == '6':
        new_db = ''
        new_lr = ''
    if choice == '7':
        print("  Cancelled.\n")
        return

    update_dashboard(filepath, new_db, new_lr)
    update_admin_links(num, new_db, new_lr)

    print(f"\n  ✅ Updated {name}")
    print(f"  Meet w/ Meg:     ✅ Always active")
    print(f"  Dropbox:         {'✅ Set' if new_db else '—  Removed'}")
    print(f"  Legacy Reports:  {'✅ Set' if new_lr else '—  Removed'}")
    print(f"\n  Deploy: npx netlify deploy --dir=. --prod\n")

def delete_client(clients, num):
    name = clients[num]['name']
    cdir = os.path.join(BASE, 'clients', num)
    reports = len(glob.glob(os.path.join(cdir, '*.html'))) if os.path.exists(cdir) else 0

    print(f"\n  ⚠️  DELETE CLIENT: {name} (#{num})")
    print(f"  ─────────────────────────────────────────")
    print(f"  This will permanently remove:")
    print(f"    • Client from clients.json")
    print(f"    • Dashboard and {reports} report files")
    print(f"    • Links from admin dashboard")
    print(f"    • Service blocks entry")
    print()
    confirm = input("  Type DELETE to confirm: ").strip()

    if confirm != 'DELETE':
        print("  Cancelled — client not deleted.\n")
        return

    # Remove from clients.json
    del clients[num]
    save_clients(clients)

    # Remove client directory
    if os.path.exists(cdir):
        remove_tree(cdir)

    # Remove from admin links
    remove_from_admin_links(num)

    # Remove from service_blocks.json
    svc_path = os.path.join(BASE, 'data', 'service_blocks.json')
    if os.path.exists(svc_path):
        with open(svc_path) as f:
            svc = json.load(f)
        if num in svc:
            del svc[num]
            write_file(svc_path, json.dumps(svc, indent=2))

    # Remove from client_health.json
    health_path = os.path.join(BASE, 'data', 'client_health.json')
    if os.path.exists(health_path):
        with open(health_path) as f:
            health = json.load(f)
        if num in health:
            del health[num]
            write_file(health_path, json.dumps(health, indent=2))

    print(f"\n  🗑️  Deleted {name} (#{num})")
    print(f"  Deploy: npx netlify deploy --dir=. --prod\n")

def main():
    global DRY_RUN
    if '--dry-run' in sys.argv:
        DRY_RUN = True
        sys.argv = [a for a in sys.argv if a != '--dry-run']
        _enable_dry_run_prefix()

    clients = load_clients()
    header()

    while True:
        print("  What would you like to do?")
        print("  1) List all clients")
        print("  2) View a client")
        print("  3) Edit client links (Dropbox / Legacy Reports)")
        print("  4) Delete a client")
        print("  5) Exit")

        choice = input("\n  Choice: ").strip()

        if choice == '1':
            list_clients(clients)

        elif choice == '2':
            num = input("  Client Number: ").strip()
            if num in clients:
                view_client(clients, num)
            else:
                print(f"  ❌ Client {num} not found.\n")

        elif choice == '3':
            num = input("  Client Number: ").strip()
            if num in clients:
                edit_links(clients, num)
            else:
                print(f"  ❌ Client {num} not found.\n")

        elif choice == '4':
            num = input("  Client Number: ").strip()
            if num in clients:
                delete_client(clients, num)
                clients = load_clients()  # Reload after delete
            else:
                print(f"  ❌ Client {num} not found.\n")

        elif choice == '5':
            print("\n  👋 Bye!\n")
            break

        else:
            print("  Invalid choice.\n")

if __name__ == '__main__':
    main()
