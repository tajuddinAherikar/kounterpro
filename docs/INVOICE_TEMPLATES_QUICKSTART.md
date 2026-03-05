# 🚀 Quick Start: Invoice Templates

## For End Users

### Setting Up Your Invoice Template (5-Minute Guide)

#### Step 1: Navigate to Invoice Templates
1. Log in to KounterPro
2. Click **Profile** in the sidebar
3. Select the **Invoice Templates** tab

#### Step 2: Choose Your Template
Pick the template that best fits your business:

- **Classic** → Traditional, professional look
- **Modern** → Clean, contemporary design  
- **GST Format** → Compliance-focused layout
- **Retail** → Compact, quick billing

Just click on the template card to select it.

#### Step 3: Upload Your Logo (Optional)
1. Click **Upload Logo** button
2. Select your logo file (PNG, JPEG, or SVG)
3. Choose logo position (Left, Center, or Right)
4. Toggle "Show Logo" on/off

**Tip:** Use a logo sized around 300x100px for best results.

#### Step 4: Pick Your Brand Color
Choose your primary brand color by:
- Clicking a preset color button, OR
- Using the color picker, OR
- Typing a hex code (e.g., #2845D6)

Your selected color will appear in invoice headers and highlights.

#### Step 5: Save Settings
Click **Save Template Settings** button at the bottom.

✅ Done! All future invoices will use your custom template!

---

## For Developers

### Quick Integration Checklist

#### 1. Database Setup
```sql
-- Run this in Supabase SQL Editor
\i INVOICE_TEMPLATES_MIGRATION.sql
```

#### 2. File Verification
Ensure these files exist:
- ✅ `src/scripts/invoice-templates.js`
- ✅ `src/scripts/supabase.js` (updated)
- ✅ `src/styles/invoice-templates.css`
- ✅ `src/pages/profile.html` (updated)
- ✅ `src/pages/create-bill.html` (updated)

#### 3. Test the System
```javascript
// Test template rendering
const result = await renderInvoiceTemplate(
    'modern', 
    invoiceData, 
    userProfile, 
    { brand_color: '#2845D6' }
);

// Test logo upload
const uploadResult = await supabaseUploadLogo(file, userId);

// Test settings update
const updateResult = await supabaseUpdateUserProfile(userId, {
    invoice_template: 'modern',
    brand_color: '#4CAF50'
});
```

#### 4. Common API Calls

**Get user's template settings:**
```javascript
const profile = await supabaseGetUserProfile(userId);
const template = profile.data.invoice_template;
const brandColor = profile.data.brand_color;
```

**Generate PDF with template:**
```javascript
await generatePDF(invoiceData); // Automatically uses user's template
```

**Upload logo:**
```javascript
const result = await supabaseUploadLogo(logoFile, userId);
if (result.success) {
    console.log('Logo URL:', result.url);
}
```

---

## Template Comparison

| Feature | Classic | Modern | GST Format | Retail |
|---------|---------|--------|------------|--------|
| Best For | Traditional business | Startups, agencies | GST compliance | Quick billing |
| Layout | Simple table | Two-column | Detailed boxes | Compact |
| Brand Color | Headers/totals | Background header | Header/borders | Totals |
| GST Breakdown | Simple | Simple | Detailed (CGST/SGST) | Simple |
| Space Usage | Medium | Medium | High detail | Compact |
| Print Pages | 1-2 | 1-2 | 1-3 | 1 |

---

## FAQs

**Q: Can I change my template after creating invoices?**  
A: Yes! Template settings apply to new invoices only. Existing invoices remain unchanged.

**Q: What image formats are supported for logos?**  
A: PNG, JPEG, and SVG files up to 2MB.

**Q: Can I use my own fonts?**  
A: Not in v1.0, but it's planned for a future release!

**Q: Do templates work in dark mode?**  
A: Yes! The settings UI supports dark mode. Generated PDFs use template colors.

**Q: Can I preview a template before saving?**  
A: Preview feature is coming soon! For now, save and test with a sample invoice.

**Q: What happens if logo upload fails?**  
A: The system will show an error message. Check file size and format, then try again.

**Q: Are templates mobile-responsive?**  
A: Yes! The settings UI works great on mobile devices.

**Q: Can I export/import template settings?**  
A: Not currently, but you can manually recreate settings on another account.

---

## Troubleshooting One-Liners

| Problem | Solution |
|---------|----------|
| Logo not showing | Enable "Show Logo" toggle and save |
| Color not applying | Use # hex format (#RRGGBB) |
| Upload fails | Check file size (max 2MB) and format |
| PDF blank | Check browser console, try classic template |
| Settings not saving | Verify internet connection, check Supabase status |
| Template looks wrong | Clear cache and hard reload (Ctrl+Shift+R) |

---

## Need More Help?

📖 Read the full guide: [INVOICE_TEMPLATES_GUIDE.md](./INVOICE_TEMPLATES_GUIDE.md)

👨‍💻 Check the code:
- Template logic: `src/scripts/invoice-templates.js`
- API functions: `src/scripts/supabase.js`
- PDF generation: `src/scripts/billing.js`

🐛 Found a bug?
Check browser console and Supabase logs for detailed error messages.

---

**Version 1.0.0** | Last updated: March 2026
