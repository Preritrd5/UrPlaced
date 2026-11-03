with open(r'src/app/preritrd/(protected)/profile/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = [
    # Card & Surface backgrounds
    ('bg-[#F8F7F3]', 'bg-card'),
    ('bg-[#FBFAF7]', 'bg-surface'),
    ('bg-[#EDECE7]', 'bg-background'),
    ('hover:bg-[#EDECE7]', 'hover:bg-surface'),
    ('hover:bg-[#F8F7F3]', 'hover:bg-card'),
    
    # Borders
    ('border-[#B8B6AC]/20', 'border-border'),
    ('border-[#B8B6AC]/30', 'border-border'),
    ('border-[#B8B6AC]/40', 'border-border'),
    ('border-[#B8B6AC]/50', 'border-border'),
    ('border-[#B8B6AC]/60', 'border-border'),
    ('border-[#B8B6AC]', 'border-border'),

    # Text colors
    ('text-[#24283A]', 'text-text-primary'),
    ('text-[#292D40]/75', 'text-text-secondary'),
    ('text-[#292D40]/80', 'text-text-secondary'),
    ('text-[#292D40]', 'text-text-secondary'),
    ('text-[#747683]', 'text-text-secondary'),

    # Primary colors
    ('bg-[#5052C9]/10', 'bg-primary/10'),
    ('bg-[#5052C9]/20', 'bg-primary/20'),
    ('bg-[#5052C9]', 'bg-primary'),
    ('text-[#5052C9]', 'text-primary'),
    ('border-[#5052C9]/20', 'border-primary/20'),
    ('border-[#5052C9]/30', 'border-primary/30'),
    ('border-[#5052C9]', 'border-primary'),
    ('hover:bg-[#4345B0]', 'hover:bg-primary-hover'),

    # Secondary colors
    ('bg-[#2E8F86]/10', 'bg-secondary/10'),
    ('bg-[#2E8F86]/20', 'bg-secondary/20'),
    ('bg-[#2E8F86]', 'bg-secondary'),
    ('text-[#2E8F86]', 'text-secondary'),
    ('border-[#2E8F86]/20', 'border-secondary/20'),
    ('border-[#2E8F86]/30', 'border-secondary/30'),
    ('border-[#2E8F86]', 'border-secondary'),
    ('hover:bg-[#267870]', 'hover:bg-secondary-hover'),
]

new_text = text
for old, new in replacements:
    new_text = new_text.replace(old, new)

# Check remaining hexes
import re
remaining_hexes = set(re.findall(r'#[0-9a-fA-F]{3,6}', new_text))
print("Remaining hexes:", remaining_hexes)
for h in remaining_hexes:
    print(f"  {h}: {new_text.count(h)} occurrences")

with open(r'src/app/preritrd/(protected)/profile/page.tsx', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Profile updated successfully!")
