# Greenhouse Iframe Fix - Testing Guide

## What Changed

The extension now properly handles Greenhouse application forms that are embedded in iframes (like the ASM careers page you showed me).

### Key Changes to `content.js`:

1. **Iframe Detection**: Added `isInIframe()` and `isGreenhouseIframe()` functions to detect when the content script is running inside an iframe.

2. **Smart Button Injection**:
   - On **parent pages** (like asm.com): Shows a WHITE button that alerts you to scroll down and use the button inside the iframe
   - On **iframe pages** (the actual Greenhouse form): Shows a GREEN button that performs the autofill

3. **Cross-Origin Handling**: Since browsers prevent JavaScript from accessing content across different domains, the extension now injects the autofill button directly inside the Greenhouse iframe.

## How to Test

### Step 1: Reload the Extension

1. Go to `chrome://extensions/`
2. Find "Job Application Autofill"
3. Click the **Reload** button (circular arrow icon)

### Step 2: Test on the ASM Page

1. Visit the page you showed me (or any ASM job posting with a Greenhouse iframe)
2. You should see **TWO buttons**:
   - One WHITE button at the top of the page (on asm.com)
   - One GREEN button inside the application form (in the Greenhouse iframe)

3. **Click the GREEN button** inside the iframe to autofill the form

### Step 3: Verify the Autofill Works

After clicking the GREEN button inside the iframe, check that these fields are populated:

- ✅ First Name
- ✅ Last Name
- ✅ Email
- ✅ Phone
- ✅ Resume upload fields (if applicable)
- ✅ Cover letter / summary fields
- ✅ LinkedIn URL
- ✅ GitHub URL
- ✅ Address fields (if present)

## Visual Indicators

### Parent Page Button (WHITE):
```
┌─────────────────────────┐
│  Autofill Application   │  ← White background
└─────────────────────────┘
```
Clicking this will show an alert telling you to use the button inside the form.

### Iframe Button (GREEN):
```
┌─────────────────────────┐
│  Autofill Application   │  ← Green background (#4CAF50)
└─────────────────────────┘
```
Clicking this will actually fill the form fields.

## Troubleshooting

### Problem: Don't see the GREEN button inside the iframe

**Solution**:
1. Scroll down to the application form embedded in the page
2. Make sure the form has fully loaded (wait a few seconds)
3. Try refreshing the page
4. Check the browser console (F12) for any errors

### Problem: Button appears but nothing happens when clicked

**Solution**:
1. Make sure you've saved your profile in the extension popup first
2. Check that you're clicking the GREEN button (inside the iframe), not the white one
3. Open the browser console (F12) and look for "Job Autofill: Inside Greenhouse iframe" message
4. Try reloading the extension

### Problem: Fields are filled but values are wrong

**Solution**:
1. Click the extension icon in your browser toolbar
2. Verify all your profile information is correct
3. Click "Save"
4. Refresh the job application page and try again

## How It Works Technically

### Before (Broken):
```
Parent Page (asm.com)
  └─ Button clicks → tries to fill fields
  └─ Iframe (greenhouse.io) ← BLOCKED by browser security
       └─ Form fields (unreachable)
```

### After (Fixed):
```
Parent Page (asm.com)
  └─ White button → shows alert
  └─ Iframe (greenhouse.io)
       └─ Content script runs here too!
       └─ Green button → fills fields ✓
       └─ Form fields (accessible)
```

The content script now runs in **both** contexts:
- On the parent page (for sites without iframes)
- Inside the Greenhouse iframe (for embedded forms)

## Next Steps

If this works well, you might want to:

1. Test on other job sites (Workday, Lever, etc.)
2. Add support for other iframe-based ATS systems
3. Improve the visual distinction between parent and iframe buttons
4. Add a success message after autofill completes

## Need Help?

If you encounter issues:
1. Check the browser console (F12 → Console tab) for error messages
2. Look for messages starting with "Job Autofill:"
3. Verify the extension permissions in `chrome://extensions/`
