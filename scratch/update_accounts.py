with open(r'src/app/preritrd/(protected)/accounts/page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

replacements = [
    ('bg-[#F8F7F3]', 'bg-card'),
    ('bg-[#FBFAF7]', 'bg-surface'),
    ('border-[#B8B6AC]/40', 'border-border'),
    ('border-[#B8B6AC]/30', 'border-border/60'),
    ('divide-[#B8B6AC]/20', 'divide-border/40'),
    ('border-[#B8B6AC]', 'border-border'),
    ('text-[#24283A]', 'text-text-primary'),
    ('text-[#292D40]/75', 'text-text-secondary'),
    ('text-[#292D40]/70', 'text-text-secondary'),
    ('text-[#292D40]', 'text-text-secondary'),
    ('text-[#747683]', 'text-text-secondary'),
    ('text-[#5052C9]', 'text-primary'),
    ('bg-[#5052C9]', 'bg-primary'),
    ('hover:bg-[#4345B0]', 'hover:bg-[var(--color-primary-hover)]'),
    ('bg-black/40 backdrop-blur-xs', 'bg-[rgba(36,40,58,0.50)] backdrop-blur-sm'),
    ('bg-black/50 backdrop-blur-xs', 'bg-[rgba(36,40,58,0.50)] backdrop-blur-sm'),
    ('border-red-300', 'border-status-danger/40'),
    ('border-red-200', 'border-status-danger/30'),
    ('bg-red-50/60', 'bg-status-danger-subtle/40'),
    ('text-red-900', 'text-status-danger'),
    ('text-red-700', 'text-status-danger'),
    ('text-red-600', 'text-status-danger'),
    ('bg-red-600 hover:bg-red-700', 'bg-status-danger hover:opacity-90'),
    ('{deleteLoading ? "Deleting..." :', '{deleteLoading ? <span className="flex items-center gap-1.5"><BrandLoader size="button" /> Deleting...</span> :'),
]

if 'BrandLoader' not in c:
    c = c.replace('import { Button } from "@/components/ui/button";', 'import { Button } from "@/components/ui/button";\nimport { BrandLoader } from "@/components/common/brand-loader";')

for src, dst in replacements:
    c = c.replace(src, dst)

with open(r'src/app/preritrd/(protected)/accounts/page.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated accounts/page.tsx successfully')
