from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
POLICIES_DIR = ROOT / "policies"
MANIFEST_PATH = ROOT / "data" / "policies.json"
OUTPUT_PATH = ROOT / "data" / "policies.js"
APP_LOGOS_DIR = ROOT / "assets" / "images" / "apps"


def escape_template_literal(value: str) -> str:
    return value.replace("`", r"\`").replace("${", r"\${")


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return value.strip("-")


def parse_front_matter(raw: str) -> tuple[dict, str]:
    if not raw.startswith("---\n"):
        return {}, raw

    parts = raw.split("\n---\n", 1)
    if len(parts) != 2:
        return {}, raw

    metadata = {}
    for line in parts[0].splitlines()[1:]:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value.isdigit():
            metadata[key] = int(value)
        else:
            metadata[key] = value

    return metadata, parts[1].lstrip()


def infer_name(content: str, fallback_stem: str) -> str:
    heading_match = re.search(r"^#\s+(.+)$", content, flags=re.MULTILINE)
    if heading_match:
        heading = heading_match.group(1).strip()
        heading = re.sub(r"^Privacy Policy for\s+", "", heading, flags=re.IGNORECASE)
        heading = heading.replace("**", "").strip()
        if heading:
            return heading
    return fallback_stem.replace("-", " ").title()


def infer_effective_date(content: str) -> str:
    match = re.search(r"^Effective date:\s*(.+)$", content, flags=re.IGNORECASE | re.MULTILINE)
    if not match:
        return ""

    raw_value = match.group(1).strip()
    for fmt in ("%Y-%m-%d", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(raw_value, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return raw_value


def infer_excerpt(content: str) -> str:
    blocks = [block.strip() for block in re.split(r"\n\s*\n", content) if block.strip()]
    for block in blocks:
        if block.startswith("#"):
            continue
        if block.lower().startswith("effective date:"):
            continue
        if block.lower().startswith("developer:"):
            continue
        if block.startswith("- "):
            continue
        excerpt = " ".join(line.strip() for line in block.splitlines()).strip()
        if excerpt:
            return excerpt if len(excerpt) <= 170 else f"{excerpt[:167].rstrip()}..."
    return "Privacy policy information for this application."


def load_overrides() -> dict[str, dict]:
    if not MANIFEST_PATH.exists():
        return {}

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return {
        item["id"]: item
        for item in manifest.get("policies", [])
        if item.get("id")
    }


def resolve_logo(policy_id: str, metadata: dict) -> str:
    explicit_logo = str(metadata.get("logo", "") or "").strip()
    if explicit_logo:
        return explicit_logo

    for extension in (".png", ".jpg", ".jpeg", ".webp"):
        candidate = APP_LOGOS_DIR / f"{policy_id}{extension}"
        if candidate.exists():
            return candidate.relative_to(ROOT).as_posix()

    return ""


def build_policy(file_path: Path, overrides: dict[str, dict]) -> dict:
    raw = file_path.read_text(encoding="utf-8")
    front_matter, content = parse_front_matter(raw)
    file_id = slugify(str(front_matter.get("id", "")) or file_path.stem)
    override = overrides.get(file_id, {})

    base = {
        "id": file_id,
        "name": front_matter.get("name") or infer_name(content, file_id),
        "shortName": front_matter.get("shortName", ""),
        "status": front_matter.get("status", "Published"),
        "effectiveDate": front_matter.get("effectiveDate") or infer_effective_date(content),
        "platform": front_matter.get("platform", "Android"),
        "category": front_matter.get("category", "App"),
        "logo": front_matter.get("logo", ""),
        "excerpt": front_matter.get("excerpt") or infer_excerpt(content),
        "order": front_matter.get("order", 9999),
        "content": escape_template_literal(content),
    }

    merged = {
        **base,
        **{key: value for key, value in override.items() if key != "source"},
    }

    if not merged.get("shortName"):
        merged["shortName"] = merged["name"]

    merged["logo"] = resolve_logo(file_id, merged)
    return merged


def main() -> None:
    overrides = load_overrides()
    policy_files = sorted(
        path for path in POLICIES_DIR.glob("*.md")
        if not path.name.startswith("_")
    )

    policies = [build_policy(path, overrides) for path in policy_files]
    policies.sort(key=lambda item: ((item.get("order") or 9999), item.get("name", "")))

    lines = ["window.PRIVACY_POLICY_DATA = {", "    policies: ["]

    for index, policy in enumerate(policies):
        lines.append("        {")
        for key in ["id", "name", "shortName", "status", "effectiveDate", "platform", "category", "logo", "excerpt", "order"]:
            lines.append(f"            {key}: {json.dumps(policy[key], ensure_ascii=False)},")
        lines.append(f"            content: `{policy['content']}`")
        lines.append("        }" + ("," if index < len(policies) - 1 else ""))

    lines.extend(["    ]", "};", ""])
    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Generated {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
