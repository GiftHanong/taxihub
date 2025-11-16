# TaxiHub Deployment Guide for Afrihost

## Overview
This guide will help you deploy your TaxiHub React application to Afrihost hosting at taxihub.co.za.

## Prerequisites
- Afrihost hosting account with cPanel access
- Domain: taxihub.co.za
- FTP access to your hosting account

## Step 1: Build Your Application

Your application has already been built and is ready for deployment. The build files are located in the `dist/` folder and compressed into `TaxiHub_Deployment.zip`.

## Step 2: Upload Files to Afrihost

### Method 1: Using cPanel File Manager
1. Log into your Afrihost cPanel
2. Go to **Files** → **File Manager**
3. **Important**: In the File Manager settings (top right gear icon), ensure these options are enabled:
   - ☑️ **Home Directory** - Shows your main account directory
   - ☑️ **Web Root (public_html or www)** - Shows the web-accessible directory
   - ☑️ **Public FTP Root (public_ftp)** - Shows FTP upload directory
   - ☑️ **Document Root for: taxihub.co.za** - Shows your domain's specific directory
   - ☑️ **Show Hidden Files (dotfiles)** - Shows files starting with . (like .htaccess)
4. Navigate to the `public_html` directory (or your domain's root directory for taxihub.co.za)
5. Upload the `TaxiHub_Deployment.zip` file
6. Extract the zip file in the root directory

### Method 2: Using FTP
1. Connect to your hosting account using an FTP client (FileZilla, etc.)
2. Upload all files from the `dist/` folder to your domain's root directory (`public_html/` or equivalent)

## Step 3: Configure Your Domain

Make sure your domain `taxihub.co.za` is properly configured to point to your hosting account. This is typically done through:
- Domain DNS settings
- Afrihost domain management panel

### Domain Setup Checklist:
1. **Domain Registration**: Ensure `taxihub.co.za` is registered and active
2. **Nameservers**: Point domain to Afrihost nameservers (usually ns1.afrihost.com and ns2.afrihost.com)
3. **DNS Propagation**: Wait 24-48 hours for DNS changes to propagate globally
4. **Hosting Assignment**: In Afrihost cPanel, ensure the domain is assigned to your hosting account

### Step-by-Step DNS Fix for "DNS_PROBE_FINISHED_NXDOMAIN":

#### Step 3A: Check Domain Registration Status
1. Go to your domain registrar's website (where you bought taxihub.co.za)
2. Log into your account
3. Search for "taxihub.co.za" in your domains
4. Verify it's active and not expired
5. If expired, renew it immediately

#### Step 3B: Verify and Update Nameservers
1. In your domain registrar's control panel, find DNS/Nameserver settings
2. Change nameservers to Afrihost's nameservers:
   - **Primary (NS1)**: `ns1.afrihost.com`
   - **Secondary (NS2)**: `ns2.afrihost.com`
3. Save changes
4. **Wait 24-48 hours** for propagation

#### Step 3C: Confirm Domain Assignment in Afrihost
1. Log into your Afrihost cPanel
2. Go to **Domains** → **Addon Domains** or **Parked Domains**
3. Ensure `taxihub.co.za` is listed and assigned to your account
4. If not listed, add it as an addon domain

#### Step 3D: Test DNS Resolution
1. Wait 24-48 hours after making changes
2. Test using online DNS tools:
   - Visit: `https://dnschecker.org/`
   - Enter: `taxihub.co.za`
   - Check if it resolves to an IP address
3. Clear your browser cache and try again
4. Try from a different device/network

#### Step 3E: Contact Support if Issues Persist
**Afrihost Support:**
- Email: support@afrihost.com
- Phone: 021 469 3050 (Cape Town) or 011 471 2000 (Johannesburg)
- Live Chat: Available on their website

**Tell them:**
- "My domain taxihub.co.za shows DNS_PROBE_FINISHED_NXDOMAIN"
- "I have hosting with you and can access cPanel"
- "Please check if the domain is properly assigned to my account"

**Domain Registrar Support:**
- Contact your domain provider
- Ask them to confirm nameserver settings
- Request assistance with DNS configuration

### Quick DNS Test Commands:
You can test DNS from command line:
```
nslookup taxihub.co.za
```
or
```
ping taxihub.co.za
```

### Expected Result:
Once DNS is working, `taxihub.co.za` should resolve to an Afrihost IP address (usually starting with 197. or 41.)

## Step 4: Verify Deployment

1. Visit `https://taxihub.co.za` in your browser
2. The application should load properly
3. Test the main functionality:
   - User app navigation
   - Marshal login
   - Firebase connectivity

## Step 5: SSL Certificate

✅ **SSL Certificate Successfully Installed!**

### Current Status:
- **Certificate Type**: Let's Encrypt (Production Ready)
- **Status**: Active and accessible via HTTPS
- **Domains Covered**:
  - ✅ `taxihub.co.za` (Primary domain)
  - ✅ `mail.taxihub.co.za` (Mail subdomain)
  - ✅ `www.taxihub.co.za` (WWW subdomain)
- **Auto-renewal**: Enabled via AutoSSL

### What This Means:
- Your site is now secure with HTTPS
- Browsers will show the green lock icon
- No more security warnings
- Better SEO and user trust

### If You Still See Security Warnings:
1. **Clear Browser Cache**: Old cached certificates may cause warnings
2. **Try Incognito Mode**: Test in a fresh browser session
3. **Check URL**: Ensure you're using `https://taxihub.co.za` (not http)
4. **Wait a Few Minutes**: SSL propagation can take a few minutes

### SSL Certificate Details:
- **Issuer**: Let's Encrypt
- **Valid Until**: Certificate auto-renews before expiration
- **Security Level**: Full HTTPS encryption

## Step 6: Additional Configuration

### .htaccess for SPA Routing (if needed)
If you encounter routing issues, create an `.htaccess` file in your root directory:

```
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

### MIME Types
Ensure these MIME types are configured in cPanel:
- `.js` → `application/javascript`
- `.css` → `text/css`
- `.json` → `application/json`
- `.webmanifest` → `application/manifest+json`

## Step 7: Testing

After deployment, thoroughly test:
- All pages load correctly
- Firebase authentication works
- Database operations function
- PWA features (if applicable)
- Mobile responsiveness

## Troubleshooting

### Common Issues:
1. **404 errors on refresh**: Add the `.htaccess` file mentioned above
2. **Assets not loading**: Check file paths and ensure all files were uploaded
3. **Firebase connection issues**: Verify Firebase configuration and security rules
4. **HTTPS issues**: Ensure SSL certificate is properly installed

### Support:
- Contact Afrihost support for hosting-related issues
- Check browser developer tools for JavaScript errors
- Verify Firebase console for authentication/database issues

## File Structure After Upload

Your `public_html/` directory should contain:
```
public_html/
├── index.html
├── vite.svg
├── assets/
│   ├── index-[hash].css
│   └── index-[hash].js
└── .htaccess (if needed)
```

## Security Considerations

1. Ensure Firebase security rules are properly configured
2. Keep your Firebase configuration keys secure
3. Regularly update dependencies
4. Monitor for any security vulnerabilities

## Performance Optimization

1. Enable gzip compression in cPanel
2. Consider using a CDN for assets if needed
3. Monitor loading times and optimize as necessary

---

**Note**: This deployment guide assumes you have a standard Afrihost shared hosting plan. If you have a different hosting configuration, some steps may vary.
