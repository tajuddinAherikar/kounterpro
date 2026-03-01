# Dynamic Company Details Update

## Overview
Company details (business name, address, contact numbers, email, GST, UPI ID) are now dynamic and pulled from your user profile instead of being hardcoded in the application.

## What's New

### 1. Business Profile Page (`profile.html`)
- New page to manage all your business information
- Access via "Business Profile" button on the dashboard
- Update your company details anytime after signup

### 2. Profile Fields
The following information can be configured:
- **Business Name*** (e.g., "Keen Batteries")
- **Business Address*** (complete address for invoices)
- **Contact Number 1*** (primary phone number)
- **Contact Number 2** (optional secondary phone)
- **Business Email*** (email for invoices)
- **GST Number** (optional, 15-character GST ID)
- **UPI ID** (optional, for payment QR codes)

*Required fields

### 3. PDF Updates
All PDF invoices and reports now use your profile data:
- Invoice headers show your business name
- Complete address from your profile
- Both contact numbers (if provided)
- Your business email
- Your GST number
- UPI QR codes use your UPI ID

### 4. WhatsApp Messages
WhatsApp invoice messages also use your business name dynamically.

## Setup Instructions

### Step 1: Update Supabase Database Schema
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the file `update-profile-schema.sql`
4. Copy all the SQL code
5. Paste it in the SQL Editor and click **Run**
6. This adds the new fields to your `user_profiles` table

### Step 2: Update Your Profile
1. Login to your app
2. Click **"Business Profile"** button on the dashboard
3. Fill in all your business information
4. Click **"Save Profile"**

### Step 3: Test
1. Create a new invoice
2. View or download the PDF
3. Verify your business details appear correctly

## Fallback Values
If you haven't updated your profile yet, the app uses these defaults:
- **Business Name**: KEEN BATTERIES
- **Address**: Indra Auto Nagar, Rangeen Masjid Road Bijapur
- **Contact 1**: 6361082439
- **Contact 2**: 8088573717
- **Email**: keenbatteries@gmail.com
- **GST**: 29AVLPA7490C1ZH
- **UPI ID**: mahammadtajuddin@ybl

## Files Modified

### New Files
- `profile.html` - Business profile settings page
- `update-profile-schema.sql` - Database migration script

### Updated Files
- `supabase.js` - Added profile get/update functions
- `billing.js` - PDF generation uses dynamic profile
- `dashboard.js` - All PDF/report functions use dynamic profile
- `index.html` - Added "Business Profile" button
- `styles.css` - Added profile page styles

## Technical Details

### New Supabase Functions
```javascript
// Get user profile
supabaseGetUserProfile(userId)

// Update user profile
supabaseUpdateUserProfile(userId, profileData)
```

### Profile Data Structure
```javascript
{
  business_name: string,
  business_address: string,
  contact_number_1: string,
  contact_number_2: string | null,
  business_email: string,
  gst_number: string | null,
  upi_id: string | null
}
```

## Benefits

1. **Personalization**: Each user can have their own business details
2. **Flexibility**: Update anytime without touching code
3. **Multi-tenant**: Support multiple businesses on same app
4. **Professional**: Invoices show correct business information
5. **Accurate QR Codes**: UPI payments go to your account

## Notes

- Profile updates are saved immediately to Supabase
- All invoices (new and existing) use current profile data when viewed
- Mobile number from signup is automatically copied to Contact Number 1
- GST and UPI ID are optional fields
- If UPI ID is not set, QR code won't be generated on invoices

## Support

If you encounter any issues:
1. Check browser console for errors
2. Verify SQL migration ran successfully
3. Ensure you're logged in
4. Try refreshing the page
5. Check that all profile fields are filled correctly
