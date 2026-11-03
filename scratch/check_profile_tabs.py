import re

with open(r'src/app/preritrd/(protected)/profile/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

tabs = re.findall(r'activeTab\s*===?\s*["\']([^"\']+)["\']', text)
print("Active tabs found:", set(tabs))

buttons = re.findall(r'setActiveTab\(["\']([^"\']+)["\']\)', text)
print("setActiveTab targets:", set(buttons))
