import os
import re

SRC_DIR = r"d:\news\yayanews-production\src"

def process_file(filepath):
    # Do not modify LocalizedLink itself
    if filepath.endswith("LocalizedLink.tsx"):
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    # Replace next/link import
    content = re.sub(
        r"import\s+(?:type\s+)?Link\s+from\s+['\"]next/link['\"];?",
        r"import LocalizedLink from '@/components/LocalizedLink';",
        content
    )

    # Some files might have import { ... } from 'next/link' but usually it's default import.
    # Replace JSX tags
    content = re.sub(r"<Link(\s|>)", r"<LocalizedLink\1", content)
    content = content.replace("</Link>", "</LocalizedLink>")

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {filepath}")

def main():
    for root, dirs, files in os.walk(SRC_DIR):
        for file in files:
            if file.endswith(".tsx") or file.endswith(".ts"):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
