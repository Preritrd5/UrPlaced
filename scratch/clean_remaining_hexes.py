with open(r'src/app/preritrd/(protected)/profile/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = [
    ('ring-[#EDECE7]', 'ring-background'),
    ('text-[#B8B6AC]', 'text-border'),
    ('focus:border-[#5052C9]', 'focus:border-primary'),
    ('divide-[#B8B6AC]/20', 'divide-border'),
    ('focus:ring-[#5052C9]', 'focus:ring-primary'),
]

for old, new in replacements:
    text = text.replace(old, new)

with open(r'src/app/preritrd/(protected)/profile/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

import re
remaining_hexes = set(re.findall(r'#[0-9a-fA-F]{3,6}', text))
print("Remaining hexes in profile/page.tsx:", remaining_hexes)
