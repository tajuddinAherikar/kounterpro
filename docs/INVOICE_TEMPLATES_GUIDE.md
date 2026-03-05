# 📄 Invoice Template System - Implementation Guide

## Overview

The KounterPro invoice template system provides customizable invoice templates with branding options. Users can choose from 4 different templates and customize them with their logo and brand colors.

---

## ✨ Features

### 1. **Multiple Invoice Templates**

- **Classic** - Simple, minimal layout for traditional businesses
- **Modern** - Clean layout with better spacing for modern businesses
- **GST Format** - Structured layout optimized for GST compliance
- **Retail** - Compact layout suitable for retail billing

### 2. **Branding Customization**

- **Logo Upload** - Upload business logo (PNG, JPEG, SVG up to 2MB)
- **Logo Position** - Choose left, center, or right alignment
- **Brand Color** - Select primary brand color for headers and highlights
- **Color Presets** - Quick selection from 8 preset colors

### 3. **Dynamic Application**

- Templates automatically apply to all new invoices
- Settings saved per user in the database
- Fallback to classic template if any errors occur

---

## 🚀 Installation Steps

### Step 1: Run Database Migration

Open Supabase SQL Editor and execute:

```sql
-- Run the migration script
-- File: INVOICE_TEMPLATES_MIGRATION.sql
```

This will:
- Add template-related columns to `user_profiles` table
- Create `business-logos` storage bucket
- Set up Row Level Security (RLS) policies
- Add validation constraints

### Step 2: Verify File Structure

Ensure these files exist in your project:

```
kounterpro/
├── src/
│   ├── pages/
│   │   ├── profile.html (updated with template tab)
│   │   └── create-bill.html (includes template script)
│   ├── scripts/
│   │   ├── invoice-templates.js (NEW - template renderers)
│   │   ├── supabase.js (updated with logo functions)
│   │   └── billing.js (updated with template integration)
│   └── styles/
│       └── invoice-templates.css (NEW - template UI styles)
└── INVOICE_TEMPLATES_MIGRATION.sql (NEW - DB migration)
```

### Step 3: Configure Settings

1. Navigate to **Profile** → **Invoice Templates** tab
2. Select your preferred template
3. Upload logo (optional)
4. Choose brand color
5. Click **Save Template Settings**

---

## 📋 Using the Template System

### For End Users

#### Setting Up Templates

1. **Access Settings**
   - Go to the Profile page
   - Click on **Invoice Templates** tab

2. **Choose Template**
   - Select from 4 available templates
   - Click "Preview Template" to see how it looks

3. **Add Branding**
   - Upload your business logo
   - Choose logo position (left/center/right)
   - Enable/disable logo display
   - Select brand color from presets or use color picker

4. **Save Settings**
   - Click **Save Template Settings**
   - Settings apply immediately to new invoices

#### Generating Invoices

Invoices now automatically use your selected template:

1. Create invoice normally in **Create Invoice** page
2. Click **Generate PDF**
3. PDF is generated using your custom template
4. Logo and brand colors are automatically applied

### For Developers

#### Template Architecture

The system uses a modular architecture:

```javascript
// Main renderer function
renderInvoiceTemplate(templateType, invoiceData, profile, settings)

// Individual template renderers
renderClassicTemplate(pdf, invoiceData, profile, settings)
renderModernTemplate(pdf, invoiceData, profile, settings)
renderGSTFormatTemplate(pdf, invoiceData, profile, settings)
renderRetailTemplate(pdf, invoiceData, profile, settings)
```

#### Adding New Templates

To add a new template:

1. **Create Renderer Function**

```javascript
// In invoice-templates.js
async function renderMyNewTemplate(pdf, invoiceData, profile, settings) {
    const brandColor = settings.brand_color || '#2845D6';
    let y = 20;
    
    // Your custom layout code here
    // Use helper functions:
    // - applyBrandColor(pdf, color)
    // - applyBrandFillColor(pdf, color)
    // - resetTextColor(pdf)
    
    return pdf;
}
```

2. **Register in Main Renderer**

```javascript
// In renderInvoiceTemplate() function
switch (templateType) {
    case 'my_new_template':
        await renderMyNewTemplate(pdf, invoiceData, profile, mergedSettings);
        break;
    // ... other cases
}
```

3. **Update Database Constraint**

```sql
ALTER TABLE user_profiles
DROP CONSTRAINT check_invoice_template;

ALTER TABLE user_profiles
ADD CONSTRAINT check_invoice_template 
CHECK (invoice_template IN ('classic', 'modern', 'gst_format', 'retail', 'my_new_template'));
```

4. **Add UI Option**

```html
<!-- In profile.html -->
<div class="template-card" data-template="my_new_template">
    <div class="template-preview">
        <span class="material-icons">star</span>
    </div>
    <div class="template-info">
        <h4>My Template</h4>
        <p>Description here</p>
    </div>
    <div class="template-radio">
        <input type="radio" name="invoiceTemplate" value="my_new_template" id="template-mynew">
        <label for="template-mynew"></label>
    </div>
</div>
```

#### Helper Functions

**Color Management:**
```javascript
// Apply color to text
applyBrandColor(pdf, '#2845D6');
pdf.text('Colored Text', 10, 10);
resetTextColor(pdf); // Back to black

// Apply color as background
applyBrandFillColor(pdf, '#2845D6');
pdf.rect(10, 10, 100, 20, 'F'); // Filled rectangle
```

**Logo Handling:**
```javascript
// Add logo to PDF
await addLogoToPDF(pdf, logoUrl, x, y, width, height);
```

**Currency Formatting:**
```javascript
// Format numbers as Indian currency
formatIndianCurrency(12500) // Returns "₹12,500"
```

#### API Functions

**Supabase Functions:**

```javascript
// Upload logo
const result = await supabaseUploadLogo(file, userId);
// Returns: { success: true, url: '...', path: '...' }

// Delete logo
const result = await supabaseDeleteLogo(filePath);
// Returns: { success: true }

// Update profile with template settings
const result = await supabaseUpdateUserProfile(userId, {
    invoice_template: 'modern',
    brand_color: '#4CAF50',
    logo_url: 'https://...',
    show_logo: true,
    logo_position: 'center'
});
```

---

## 🎨 Template Specifications

### Classic Template
- **Use Case:** Traditional businesses, conservative look
- **Features:** 
  - Simple header
  - Clean table layout
  - Minimal spacing
  - GST and contact details
- **Best For:** Service businesses, wholesalers

### Modern Template
- **Use Case:** Modern businesses, startups
- **Features:**
  - Brand color header background
  - Side-by-side company/customer info
  - Alternating row colors
  - Clean typography
- **Best For:** Tech companies, creative agencies

### GST Format Template
- **Use Case:** GST compliance requirements
- **Features:**
  - Detailed GST breakdown (CGST/SGST)
  - HSN code column
  - Structured format with borders
  - Seller/Buyer detail boxes
- **Best For:** Manufacturers, distributors

### Retail Template
- **Use Case:** Quick retail transactions
- **Features:**
  - Compact layout
  - Minimal fields
  - Quick totals
  - Space-efficient
- **Best For:** Retail stores, quick billing

---

## 🗄️ Database Schema

### user_profiles Table Extensions

```sql
Column Name       | Type          | Default     | Description
------------------|---------------|-------------|------------------
invoice_template  | VARCHAR(50)   | 'classic'   | Template type
brand_color       | VARCHAR(7)    | '#2845D6'   | Hex color code
logo_url          | TEXT          | NULL        | Logo URL in storage
logo_position     | VARCHAR(20)   | 'left'      | Logo alignment
show_logo         | BOOLEAN       | true        | Show/hide logo
```

### Storage Bucket

- **Name:** `business-logos`
- **Public:** Yes (read-only)
- **RLS Policies:**
  - Users can upload to their own folder
  - Users can update/delete their own logos
  - Public read access for invoices

---

## 🎯 Best Practices

### For Users

1. **Logo Guidelines:**
   - Use transparent PNG for best results
   - Recommended size: 300x100px
   - Keep file size under 500KB for faster loading
   - Use high-resolution images for print quality

2. **Color Selection:**
   - Choose colors with good contrast
   - Test visibility on white background
   - Consider printer-friendly colors
   - Avoid very light colors

3. **Template Selection:**
   - Classic: Best for formal business
   - Modern: Great for brand-focused businesses
   - GST Format: Required for GST compliance
   - Retail: Quick and compact for retail

### For Developers

1. **Error Handling:**
   - Always wrap template rendering in try-catch
   - Provide fallback to classic template
   - Log errors for debugging
   - Show user-friendly error messages

2. **Performance:**
   - Optimize logo file sizes
   - Use async/await for logo loading
   - Cache profile settings when possible
   - Minimize PDF generation time

3. **Testing:**
   - Test all templates with sample data
   - Verify color contrast
   - Check dark mode compatibility
   - Test on different screen sizes

---

## 🐛 Troubleshooting

### Common Issues

#### Logo Not Appearing
- **Problem:** Logo uploaded but not showing in PDF
- **Solution:** 
  - Check if `show_logo` is enabled
  - Verify logo URL is accessible
  - Ensure storage bucket is public
  - Check browser console for errors

#### Colors Not Applying
- **Problem:** Brand color not showing in PDF
- **Solution:**
  - Verify hex color format (#RRGGBB)
  - Check if template renderer uses brand color
  - Clear browser cache
  - Re-save template settings

#### PDF Generation Fails
- **Problem:** Error when generating PDF
- **Solution:**
  - Check browser console for errors
  - Verify jsPDF library is loaded
  - Ensure invoice data is complete
  - Try classic template as fallback

#### Template Not Saving
- **Problem:** Settings don't persist after save
- **Solution:**
  - Check network tab for API errors
  - Verify user is authenticated
  - Check database constraints
  - Review Supabase console for errors

### Debug Mode

Enable debug logging:

```javascript
// Add to billing.js
console.log('Template Type:', templateType);
console.log('Settings:', settings);
console.log('Profile:', userProfile);
```

---

## 🔒 Security Considerations

1. **File Upload Validation:**
   - Only allow image file types
   - Limit file size to 2MB
   - Validate MIME types server-side
   - Scan for malicious content

2. **Storage Security:**
   - RLS policies restrict uploads to user's folder
   - Public read access for invoices only
   - Automatic cleanup of old logos recommended

3. **Data Validation:**
   - Hex color validation (#RRGGBB)
   - Template type validation (enum check)
   - Logo URL validation
   - XSS prevention on text fields

---

## 📈 Future Enhancements

### Planned Features

1. **Template Preview:**
   - Live preview of template with sample data
   - Preview modal before saving
   - Side-by-side template comparison

2. **Advanced Customization:**
   - Custom fonts
   - Multiple color schemes
   - Footer customization
   - Header/footer text

3. **Template Marketplace:**
   - Community-created templates
   - Template import/export
   - Template versioning
   - Template ratings

4. **Print Optimization:**
   - Dedicated print stylesheets
   - Page break optimization
   - Print preview
   - Printer settings

---

## 📞 Support

For issues or questions:

1. Check the troubleshooting section
2. Review browser console for errors
3. Check Supabase logs
4. Refer to code comments in:
   - `invoice-templates.js` (template logic)
   - `supabase.js` (API functions)
   - `billing.js` (PDF generation)

---

## 📝 Changelog

### Version 1.0.0 (Initial Release)
- ✅ 4 invoice templates (Classic, Modern, GST, Retail)
- ✅ Logo upload and management
- ✅ Brand color customization
- ✅ Template selection UI
- ✅ Database migration
- ✅ Dark mode support
- ✅ Mobile responsive design

---

## 🏆 Credits

Developed for KounterPro invoicing system.

Template system architecture by GitHub Copilot.

---

**Happy Invoicing! 🎉**
