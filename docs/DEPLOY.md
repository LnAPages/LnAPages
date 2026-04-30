# Deploy notes

## Required post-merge step

Apply remote D1 migrations after merge and before relying on new API behavior:

```bash
wrangler d1 migrations apply lnapages --remote
```
