# CLOUDFLARE SETUP GUIDE - Free Plan

## Option A: Use Free Domain (Easiest)

### Get Free Domain from Freenom
1. Go to: https://www.freenom.com/
2. Search for a domain name (e.g., "pwx-inventory")
3. Choose free extension: `.tk`, `.ml`, `.ga`, or `.cf`
4. Register for 12 months (free)
5. Go to My Domains
6. Manage Domain → Nameservers
7. Change to Cloudflare nameservers (next step)

### Or use existing domain

---

## Step 1: Add Domain to Cloudflare (Free)

1. Go to: https://dash.cloudflare.com/
2. Click "Add a site"
3. Enter your domain name (e.g., `pwx-inventory.tk`)
4. Select **Free plan** ($0/month)
5. Click "Continue"

---

## Step 2: Update Nameservers

Cloudflare will show you 2 nameservers:
- `ns1.cloudflare.com`
- `ns2.cloudflare.com`

Go to your domain registrar (Freenom/GoDaddy/etc):
1. Find "Nameservers" or "DNS"
2. Replace with Cloudflare nameservers
3. Save changes
4. Wait 24 hours for DNS propagation (usually 5-30 mins)

---

## Step 3: Create DNS A Record in Cloudflare

1. Login to Cloudflare Dashboard
2. Select your domain
3. Go to **DNS** tab
4. Click **Add record**

**For Local Network Access:**
- Type: `A`
- Name: `inventory` (or your subdomain)
- IPv4 address: `192.168.88.253`
- Proxy: OFF (Gray cloud - DNS only)
- TTL: Auto
- Click Save

Result: `inventory.pwx-inventory.tk` → `192.168.88.253:8080`

---

## Step 4: Access Your App

After DNS propagates:

```
http://inventory.pwx-inventory.tk:8080
```

Works from:
- ✓ Same WiFi network
- ✓ Different router (same network)
- ✓ Mobile devices on same network
- ✓ Any device that can resolve DNS

---

## Step 5: (Optional) Enable HTTPS

Cloudflare free plan includes SSL:
1. Go to **SSL/TLS** tab
2. Encryption mode: "Flexible"
3. Your app now accessible via:

```
https://inventory.pwx-inventory.tk:8080
```

---

## What You'll Get

| Feature | Cloudflare Free |
|---------|-----------------|
| Domain | Free (.tk/.ml/.ga) or your own |
| SSL/HTTPS | ✓ Yes |
| DNS | ✓ Yes |
| DDoS Protection | ✓ Yes |
| Cost | $0 |
| Works across networks | ✓ Yes (same local network) |

---

## Current Setup

Your app is running on:
- **Local IP**: `192.168.88.253:8080`
- **Hostname**: `DESKTOP-V8J6T0M:8080`
- **After Cloudflare**: `inventory.pwx-inventory.tk:8080`

---

## Next Steps

1. Register free domain at Freenom.com
2. Add domain to Cloudflare (free)
3. Update nameservers
4. Create A record pointing to `192.168.88.253`
5. Wait for DNS propagation
6. Access app via domain name

**Questions?** Let me know when you:
- Have registered a domain
- Added it to Cloudflare
- Created the DNS A record
