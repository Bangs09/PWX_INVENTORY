# CLOUDFLARE NAMESERVER UPDATE - STEP BY STEP

## Your Domain
- Domain: `pwxinventory.dpdns.org`
- Current IP: `192.168.88.253`
- Current Port: `8080`

---

## Step 1: Add Domain to Cloudflare (Do This First)

1. Go to: https://dash.cloudflare.com/
2. Click **"Add a site"** (top right)
3. Type: `pwxinventory.dpdns.org`
4. Click **Continue**
5. Choose **Free Plan**
6. Click **Continue**

Cloudflare will show you **2 Nameservers**. They look like:
```
ns1.cloudflare.com
ns2.cloudflare.com
```

**COPY THESE NAMESERVERS** - you'll need them in Step 2.

---

## Step 2: Update Nameservers in Your Registrar

### If registered with dpdns.org:

1. Go to: https://dpdns.org/
2. Login with your account
3. Find **"Manage Domain"** or **"DNS Settings"**
4. Look for **"Nameservers"** section
5. Replace current nameservers with Cloudflare's:
   - `ns1.cloudflare.com`
   - `ns2.cloudflare.com`
6. Click **Save** or **Update**

### If registered elsewhere:

Same steps, but at your registrar's website.

---

## Step 3: Create DNS A Record in Cloudflare

Wait 5 minutes after updating nameservers, then:

1. Go to Cloudflare Dashboard
2. Select **pwxinventory.dpdns.org**
3. Go to **DNS** (left menu)
4. Click **+ Add record**
5. Fill in:
   ```
   Type: A
   Name: @ (or blank)
   IPv4 Address: 192.168.88.253
   Proxy status: OFF (Gray cloud)
   TTL: Auto
   ```
6. Click **Save**

---

## Step 4: Verify DNS (Wait 5-30 minutes, then test)

Open PowerShell and run:
```powershell
nslookup pwxinventory.dpdns.org
```

**Expected result:**
```
Server: cloudflare DNS
Address: 1.1.1.1

Name: pwxinventory.dpdns.org
Address: 192.168.88.253
```

---

## Step 5: Access Your App

Once DNS works:
```
http://pwxinventory.dpdns.org:8080
```

From any device on your network!

---

## Need Help?

Tell me:
1. Where is your domain registered?
2. Can you access the registrar's settings?
3. Do you see a "Nameservers" or "DNS" option?

I'll guide you through the exact steps for your registrar.
