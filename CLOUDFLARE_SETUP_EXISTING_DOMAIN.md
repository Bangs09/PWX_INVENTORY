# CLOUDFLARE SETUP FOR pwxinventory.dpdns.org

## Step 1: Add Domain to Cloudflare

1. Go to: https://dash.cloudflare.com/
2. Click **"Add a site"** (top right)
3. Enter: `pwxinventory.dpdns.org`
4. Click **"Continue"**
5. Select **Free plan** ($0/month)
6. Click **"Continue"**

---

## Step 2: Update Nameservers

Cloudflare will provide 2 nameservers. Copy them:
- `ns1.cloudflare.com`
- `ns2.cloudflare.com`

Go to your domain registrar (dpdns.org or wherever you registered):
1. Login to your account
2. Find **DNS Settings** or **Nameservers**
3. Replace old nameservers with Cloudflare ones
4. Save changes
5. Wait for DNS propagation (5 minutes - 24 hours, usually 5-30 mins)

---

## Step 3: Create DNS A Record in Cloudflare

1. Login to Cloudflare Dashboard
2. Select **pwxinventory.dpdns.org**
3. Go to **DNS** (left sidebar)
4. Click **"+ Add record"**

**Fill in:**
- **Type**: A
- **Name**: @ (or leave blank for root domain)
- **IPv4 address**: `192.168.88.253`
- **Proxy status**: OFF (Gray cloud icon - DNS only)
- **TTL**: Auto
- Click **"Save"**

---

## Step 4: Access Your App

Once DNS propagates (check with `nslookup pwxinventory.dpdns.org`):

```
http://pwxinventory.dpdns.org:8080
```

Or with HTTPS:
```
https://pwxinventory.dpdns.org:8080
```

---

## Step 5: Enable HTTPS (Optional but Recommended)

1. In Cloudflare Dashboard
2. Go to **SSL/TLS** tab
3. Set **Encryption mode** to "Flexible"
4. App now accessible via HTTPS

---

## Current Setup

Your app running on:
- **IP Address**: `192.168.88.253:8080`
- **Hostname**: `DESKTOP-V8J6T0M:8080`
- **After Cloudflare**: `pwxinventory.dpdns.org:8080`

---

## Verify DNS is Working

Run this to check DNS propagation:

```bash
nslookup pwxinventory.dpdns.org
```

Should return: `192.168.88.253`

---

## Troubleshooting

**Domain not resolving?**
- Wait 5-30 minutes for DNS to propagate
- Check nameservers updated in registrar: `nslookup pwxinventory.dpdns.org`
- Verify A record created in Cloudflare

**Still can't access?**
- Ensure Docker container running: `docker ps`
- Check port 8080 accessible: `netstat -ano | findstr 8080`
- Clear browser cache (Ctrl+Shift+Delete)

---

## Benefits with Cloudflare Free

✓ Free domain (you already have it)
✓ Free SSL/HTTPS encryption
✓ DDoS protection
✓ Works across local networks
✓ Professional domain
✓ No cost
