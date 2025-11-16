# TaxiHub Deployment Guide for Afrihost

## Overview
This guide will help you deploy your TaxiHub React application to Afrihost hosting at taxihub.co.za.

## Prerequisites
- Afrihost hosting account with cPanel access
- Domain: taxihub.co.za
- FTP access to your hosting account

## Step 1: Build Your Application

Your application has already been built and is ready for deployment. The build files are located in the `dist/` folder and compressed into `TaxiHub_Deployment.zip`.

## Step 2: Prepare Your Hosting Directory

### Reset/Clear public_html Directory (Optional but Recommended)

If you want to start fresh or remove existing files from your `public_html` directory before uploading TaxiHub:

1. **Log into your Afrihost cPanel**
2. **Go to Files → File Manager**
3. **Settings gear icon → Select "Web Root (public_html or www)"**
4. **Navigate to the `public_html` directory**
5. **Select all files and folders** (Ctrl+A or check the box next to "Name")
6. **Click "Delete"** (trash can icon)
7. **Confirm deletion** when prompted
8. **The directory is now empty and ready for your TaxiHub files**

**⚠️ Important Notes:**
- This will permanently delete all existing files in `public_html`
- If you have important files, download them first using the "Download" option
- The `.htaccess` file will be recreated when you upload TaxiHub files
- This step is optional but ensures a clean deployment

## Step 3: Upload Files to Afrihost

### Method 1: Using SSH/SFTP (Terminal/Command Line - Recommended - Faster & More Reliable)

**Note**: SSH upload uses terminal commands and is the fastest method, but requires SSH access to be enabled on your Afrihost account. If SSH is not enabled or connection is refused, use Method 2 (cPanel) instead.

#### Step 1: Enable SSH Access in Afrihost Account
First, ensure SSH is enabled on your Afrihost account:

1. **Log into your Afrihost cPanel**
2. **Go to Security → SSH Access**
3. **If SSH is disabled**, contact Afrihost support to enable it for your account
4. **Generate or add your SSH key** (see below)

#### Step 2: Add SSH Key to Afrihost Account
If SSH is enabled, add your SSH public key:

1. **Copy your SSH public key:**
   ```
   ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDqaFTT7GMFUbAhnfuN2K7VzRy76LkQlrpJPzH5H56+73yuDRlmajm107UdgCvYrAjxcu5z4XRqtlHRpLA5tzlOHbBjWEuRwrWfKYi7GQpkTdjDjZBtFK5wnWzpB8+CNbwXYivldw7NdUUD9noT+I2cr80N/mk6n014JziCgOdTMjo92R2wjZ4aaZJM5UGBfJ/KoOeRVzvRSGn5AoFDX3SRqEGfNwsDK5RdyHrAcw49IbtXewz61o4bKhbjodzgtvhHz13WwdLvdY+55MrBJirnGvDvnuO/zhpeP/hoEgolZiShWPDkXH3NKk29jbQpivew54fxiwLk4RKlw79bHIGP
   ```

   **Note**: This is your actual SSH public key from `C:\Users\HP\Downloads\id_rsa.pub`. If you have a different key file, use the content from your `.pub` file.

2. **Add to Afrihost cPanel:**
   - Go to **Security** → **SSH Access**
   - Click **Manage SSH Keys**
   - Click **Import Key**
   - Paste your public key in the **Public Key** field
   - Give it a name (e.g., "TaxiHub Deployment Key")
   - Click **Import**

3. **Authorize the key:**
   - Find your imported key
   - Click **Authorize** next to it

#### Step 3: Upload and Deploy via Terminal (SSH)

**Windows PowerShell/Command Prompt:**
1. **Upload the file via SCP (secure copy):**
   ```
   scp TaxiHub_Deployment.zip taxihux9c9z6@taxihub.co.za:~/public_html/
   ```

2. **Connect via SSH:**
   ```
   ssh taxihux9c9z6@taxihub.co.za
   ```

3. **Navigate to public directory:**
   ```
   cd public_html
   ```

4. **Extract the files:**
   ```
   unzip TaxiHub_Deployment.zip
   ```

5. **Set proper permissions:**
   ```
   chmod -R 755 .
   chmod -R 644 assets/*
   ```

6. **Exit SSH:**
   ```
   exit
   ```

**Current SSH Status**: SSH connection is currently being refused (likely SSH not enabled on your Afrihost account). Contact Afrihost support to enable SSH access, or use Method 2 below.

#### Alternative: Use cPanel File Manager for Upload (If SSH Not Available)
If SSH is not enabled or not working, use cPanel File Manager:

1. Log into your Afrihost cPanel
2. Go to **Files** → **File Manager**
3. Navigate to `public_html` directory
4. Upload `TaxiHub_Deployment.zip`
5. Extract the zip file
6. The application will be live immediately

### Method 2: Using cPanel File Manager
1. Log into your Afrihost cPanel
2. Go to **Files** → **File Manager**
3. **Important**: In the File Manager settings (top right gear icon), select **Web Root (public_html or www)** - this shows your web-accessible directory where domain files are stored.

   **Note**: You can only choose one view at a time. For uploading your TaxiHub files, select "Web Root (public_html or www)" to access the public_html directory.
4. Navigate to the `public_html` directory (or your domain's root directory for taxihub.co.za)
5. Upload the `TaxiHub_Deployment.zip` file
6. Extract the zip file in the root directory

### Method 3: Using FTP
1. Connect to your hosting account using an FTP client (FileZilla, etc.)
2. Use these connection details:
   - **Host**: taxihub.co.za
   - **Username**: taxihux9c9z6 (or your cPanel username)
   - **Password**: Your cPanel password
   - **Port**: 21
3. Upload all files from the `dist/` folder to your domain's root directory (`public_html/` or equivalent)

## Step 3: Configure Your Domain

✅ **Domain Status Confirmed: REGISTERED AND ACTIVE**

Afrihost has confirmed that `taxihub.co.za` is registered and active. Since you can access cPanel, the domain is properly assigned to your hosting account.

### Current Domain Status:
- **Registration**: ✅ Active
- **Hosting Assignment**: ✅ Confirmed (cPanel accessible)
- **SSL Certificate**: ✅ Let's Encrypt installed

### Remaining Issue: DNS Resolution
The DNS_PROBE_FINISHED_NXDOMAIN error suggests the domain's DNS records are not properly configured to point to Afrihost's servers.

### Quick DNS Fix:
1. **Contact Your Domain Registrar**: Ask them to update nameservers to:
   - `ns1.afrihost.com`
   - `ns2.afrihost.com`

2. **Or Contact Afrihost**: Since they confirmed registration, ask them to verify DNS configuration from their end.

3. **Test Resolution**: After changes, test with:
   ```
   nslookup taxihub.co.za
   ```

### Expected Result:
Once DNS is working, `taxihub.co.za` should resolve to an Afrihost IP address (usually starting with 197. or 41.)

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

🎉 **GREAT PROGRESS!** Your domain is now resolving and HTTPS is working! The mixed content error indicates that DNS is fixed and SSL is active, but Afrihost is currently showing their default "coming soon" page instead of your TaxiHub application.

### Current Status:
- ✅ **DNS**: Working (domain resolves)
- ✅ **HTTPS**: Active (SSL certificate working)
- ⚠️ **Files**: Not yet uploaded (showing Afrihost default page)

### Next Step: Upload Your TaxiHub Files

**SSH Connection Issue Detected - Use cPanel Method Instead:**

Since SSH connection is being refused (likely SSH not enabled on your Afrihost account), use the cPanel File Manager method:

#### **cPanel Upload Method (Recommended):**
1. Log into your Afrihost cPanel
2. Go to **Files** → **File Manager**
3. Navigate to `public_html` directory
4. Click **Upload** (top toolbar)
5. Select `TaxiHub_Deployment.zip` from your local machine
6. Wait for upload to complete
7. Right-click the uploaded zip file
8. Select **Extract**
9. Confirm extraction to the current directory (`public_html`)
10. **Set proper file permissions** (see section below)
11. Delete the zip file after extraction
12. Visit `https://taxihub.co.za` - your site should be live!

### File Permissions After Upload

After extracting the TaxiHub files, ensure the following permissions are set correctly in cPanel File Manager:

#### **Directory Permissions (755):**
- `public_html/` → `0755` (owner: read/write/execute, group: read/execute, others: read/execute)
- `assets/` → `0755`
- `.well-known/` → `0755`

#### **File Permissions (644):**
- `index.html` → `0644` (owner: read/write, group: read, others: read)
- `vite.svg` → `0644`
- `.htaccess` → `0644`
- All files in `assets/` folder → `0644`

#### **How to Set Permissions in cPanel:**
1. Right-click on each file/directory in File Manager
2. Select **"Change Permissions"**
3. Set the numeric value (755 for directories, 644 for files)
4. Click **"Change Permissions"**

#### **Current Permissions Status:**
Based on your file listing, the permissions look correct:
- Directories: `0755` ✅
- Files: `0644` ✅

**Note**: These permissions allow the web server to read your files while maintaining security. The web server runs as a different user but needs read access to serve your content.

#### **Alternative: FTP Upload**
If cPanel upload is slow, use FTP:
- Host: `taxihub.co.za`
- Username: `taxihux9c9z6`
- Password: Your cPanel password
- Port: 21
- Upload `TaxiHub_Deployment.zip` to `public_html/`
- Extract on server or locally and upload all files

### After Upload, Test:
1. Visit `https://taxihub.co.za` in your browser
2. TaxiHub application should load (no more "coming soon" page)
3. Test the main functionality:
   - User app navigation
   - Marshal login
   - Firebase connectivity

### If You Still See Mixed Content:
The blocked resources (typeface.js, ltv_*.js, favicon.png) are from Afrihost's default page. Once you upload TaxiHub files, these will be replaced with your secure resources.

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

### Existing .htaccess Configuration
Your server already has a cPanel-generated `.htaccess` file with PHP handler configuration:

```apache
# php -- BEGIN cPanel-generated handler, do not edit
# Set the "ea-php84" package as the default "PHP" programming language.
<IfModule mime_module>
  AddHandler application/x-httpd-ea-php84 .php .php8 .phtml
</IfModule>
# php -- END cPanel-generated handler, do not edit
```

**Note**: This PHP configuration is normal and won't interfere with your React application. Keep this configuration as-is.

### .htaccess for SPA Routing (if needed)
If you encounter routing issues with your React SPA, add these rules **after** the existing PHP handler configuration:

```
# php -- BEGIN cPanel-generated handler, do not edit
# Set the "ea-php84" package as the default "PHP" programming language.
<IfModule mime_module>
  AddHandler application/x-httpd-ea-php84 .php .php8 .phtml
</IfModule>
# php -- END cPanel-generated handler, do not edit

# Handle React Router
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
