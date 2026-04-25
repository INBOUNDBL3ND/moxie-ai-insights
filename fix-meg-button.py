#!/usr/bin/env python3
"""Fix missing Meet w/ Meg button on all client dashboards."""
import glob, re

MEG_BTN = '<a href="https://calendly.com/walkermeg" target="_blank" rel="noopener noreferrer" style="background:#fff;color:#1D80DE;padding:12px 22px;border-radius:10px;font-size:1rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:10px;width:100%;justify-content:center;box-sizing:border-box;border:2px solid #1D80DE;"><img src="/assets/meg-headshot.png" alt="Meg" style="width:32px;height:32px;border-radius:50%;"> Meet w/ Meg</a>'

fixed = 0
for f in glob.glob('clients/*/index.html'):
    with open(f) as fh:
        c = fh.read()
    if 'calendly' in c:
        continue
    num = f.split('/')[1]
    if 'position:absolute;top:16px;right:0' in c:
        c = c.replace(
            'position:absolute;top:16px;right:0;display:flex;flex-direction:column;gap:8px;align-items:flex-end;">',
            'position:absolute;top:16px;right:0;display:flex;flex-direction:column;gap:8px;align-items:flex-end;">' + MEG_BTN
        )
    elif 'dashboard-header" style="position:relative;">' in c:
        c = c.replace(
            'dashboard-header" style="position:relative;">',
            'dashboard-header" style="position:relative;">\n      <div style="position:absolute;top:16px;right:0;display:flex;flex-direction:column;gap:8px;align-items:flex-end;">' + MEG_BTN + '</div>'
        )
    elif 'dashboard-header">' in c:
        c = c.replace(
            'dashboard-header">',
            'dashboard-header" style="position:relative;">\n      <div style="position:absolute;top:16px;right:0;display:flex;flex-direction:column;gap:8px;align-items:flex-end;">' + MEG_BTN + '</div>'
        )
    else:
        print(f'  SKIPPED {num}')
        continue
    with open(f, 'w') as fh:
        fh.write(c)
    fixed += 1
    print(f'  Fixed: {num}')
print(f'\nAdded Meet w/ Meg to {fixed} dashboards')
