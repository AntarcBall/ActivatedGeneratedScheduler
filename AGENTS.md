# Project Agent Notes

## GitHub Pages Deployment

This repository deploys from the `gh-pages` branch root using GitHub Pages
legacy builds. After pushing app/data changes, verify both the source branch and
the actual Pages site.

Normal deploy check:

```bash
gh run list --repo AntarcBall/ActivatedGeneratedScheduler --branch gh-pages --limit 5
gh api repos/AntarcBall/ActivatedGeneratedScheduler/pages --jq '{status:.status, html_url:.html_url}'
```

Common failure mode:

- The Pages workflow `build` job succeeds.
- The `deploy` job fails with `Deployment failed, try again later.`
- `gh run list` may show old dynamic Pages runs stuck as `queued`.
- The repository source is already pushed, but `https://antarcball.github.io/ActivatedGeneratedScheduler/` still serves older files.

When that happens, do not keep making empty commits repeatedly. Trigger the
legacy Pages build API directly:

```bash
gh api -X POST repos/AntarcBall/ActivatedGeneratedScheduler/pages/builds \
  --jq '{status:.status, url:.url, commit:.commit}'
```

Then poll the latest build:

```bash
gh api repos/AntarcBall/ActivatedGeneratedScheduler/pages/builds/latest \
  --jq '{status:.status, commit:.commit, error:.error.message, updated_at:.updated_at}'
gh api repos/AntarcBall/ActivatedGeneratedScheduler/pages --jq '{status:.status, html_url:.html_url}'
```

Completion criteria:

- `pages.status` is `built`.
- `pages/builds/latest.status` is `built`.
- The latest build commit matches the current pushed `gh-pages` commit.
- At least one changed static file is verified from the live Pages URL, not just
  from `raw.githubusercontent.com`.

Useful live verification examples:

```bash
python3 - <<'PY'
import json, urllib.request

urls = [
    "https://antarcball.github.io/ActivatedGeneratedScheduler/lectures.json",
    "https://antarcball.github.io/ActivatedGeneratedScheduler/assets/ags-section-details.json",
]

for url in urls:
    with urllib.request.urlopen(url, timeout=20) as response:
        data = json.loads(response.read().decode("utf-8"))
    print(url, len(data) if isinstance(data, list) else data.get("generated_at"))
PY
```

## Data Refresh Hygiene

- Never commit Sugang `Cookie`, `JSESSIONID`, student number, or student name.
- Keep source XLS/PDF capture files uncommitted unless explicitly requested.
- After changing JSON/CSV data, run:

```bash
python3 - <<'PY'
import csv, json
for path in [
    "lectures.json",
    "lectures_eng.json",
    "assets/ags-section-details.json",
    "assets/ags-open-course-metadata.json",
    "assets/ags-track-requirements.json",
    "assets/ags-semiconductor-course-tags.json",
]:
    with open(path, encoding="utf-8") as handle:
        json.load(handle)
    print(path, "ok")

with open("assets/ags-section-detail-availability.csv", encoding="utf-8") as handle:
    rows = list(csv.DictReader(handle))
print("availability", len(rows), sum(row["available"] == "Y" for row in rows))
PY
git diff --check
```
