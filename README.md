# prathameshjadhav.in

Personal site, served via GitHub Pages from `lollinng.github.io`, pointed at the custom domain `prathameshjadhav.in` (GoDaddy).

## Local preview

Just open `index.html` in a browser, or:

```bash
python3 -m http.server 8000
```

## Deploy

Push to `main`. GitHub Pages serves automatically.

## DNS (GoDaddy → GitHub Pages)

Apex `prathameshjadhav.in` — A records:

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

`www` subdomain — CNAME to `lollinng.github.io`.
