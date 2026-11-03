import os
import re

directories = [
    r'src/app/preritrd',
    r'src/components/platform-admin'
]

results = {}

for d in directories:
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith(('.tsx', '.ts')):
                path = os.path.join(root, f)
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    hexes = re.findall(r'#[0-9a-fA-F]{3,6}', content)
                    if hexes:
                        results[path] = hexes

print(f"Files with hexes: {len(results)}")
for path, hexes in results.items():
    print(f"{path}: {len(hexes)} occurrences ({set(hexes)})")
