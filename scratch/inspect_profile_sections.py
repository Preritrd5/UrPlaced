with open(r'src/app/preritrd/(protected)/profile/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines[500:1000], start=501):
    if '{/* ===' in l or '{/* ---' in l or '<Card' in l or '<h2' in l or '<h3' in l or 'SECTION' in l:
        print(f"Line {i}: {l.strip()}")
