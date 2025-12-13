# Feature Locations Guide

This document shows where you can find all the implemented features in your Erato app.

## 📍 Navigation & Access Points

### 1. **Commission Form Builder** (For Artists)
**Location:** Commission Packages Management Screen
- **Path:** `/commission-packages` (or navigate from Artist Profile → "Manage" link on Packages section)
- **How to access:**
  1. Go to your Artist Profile (tap your profile icon)
  2. Scroll to "Commission Packages" section
  3. Tap "Manage" button
  4. When creating/editing a package, you'll see a "Custom Form Fields" section
  5. Tap "Build Form" to open the drag-and-drop form builder

**What you can do:**
- Add custom fields (text, number, select, file upload, etc.)
- Reorder fields by dragging
- Set field properties (required, validation, options)
- Apply templates
- Preview the form

---

### 2. **Reference Management** (Pinterest-style Board)
**Location:** Commission Conversation Screen
- **Path:** `/messages/[id]` (any commission conversation)
- **How to access:**
  1. Go to Messages tab
  2. Open any commission conversation
  3. Look for the "References" button (images icon) in the header
  4. Tap it to open the full-screen reference board

**What you can do:**
- View all reference materials (images, links, color palettes)
- Filter by type (All, Images, Links, Colors)
- Upload new reference images
- Add portfolio/external links
- Create color palettes with the color picker
- Delete references
- Pinterest-style grid layout

---

### 3. **Verification System**
**Location:** Dedicated Verification Screen
- **Path:** `/verification`
- **How to access:**
  - Navigate to `/verification` route (you may need to add a link in your navigation/settings)
  - Or access via: Profile → Settings → Verification (if you add this link)

**What you can do:**
- Submit verification requests for:
  - **Portfolio Verified:** Link professional portfolios (ArtStation, DeviantArt, etc.)
  - **Payment Verified:** Earned automatically after completing commissions
  - **Identity Verified:** Upload government ID
- View submission status (Pending, Approved, Rejected)
- See requirements for each badge type
- View past submissions

**Badge Display:**
- Verification badges appear on artist profiles next to the artist name
- Location: `/artist/[id]` - Look for badges next to the artist's name

---

### 4. **Payment System**
**Location:** Commission Conversation Screen
- **Path:** `/messages/[id]` (commission conversations)
- **How to access:**
  1. Go to Messages tab
  2. Open a commission conversation
  3. Tap the commission details (or commission info button)
  4. Scroll down to see payment sections

**Features available:**
- **Payment Options:** For clients with pending commissions
  - Choose payment type (Full, Deposit, Milestone)
  - Select deposit percentage
  - View payment breakdown
- **Escrow Status:** Shows if funds are held in escrow
  - Release funds button (for completed commissions)
- **Milestone Tracker:** For milestone-based payments
  - View all milestones
  - Pay individual milestones
  - See payment status
- **Transaction History:** View all transactions
  - Payment amounts
  - Platform fees
  - Artist payouts
  - Transaction status
- **Tip Jar:** For completed commissions
  - Tip the artist with preset or custom amounts

---

### 5. **Enhanced Review System**
**Location:** Artist Profile Page
- **Path:** `/artist/[id]`
- **How to access:**
  1. Navigate to any artist profile
  2. Scroll down past packages section
  3. You'll see the "Reviews" section

**Features available:**
- **Review Cards:**
  - Star ratings
  - Review comments
  - "Verified Commission" badge (for verified purchases)
  - Reviewer info and date
- **Artist Responses:**
  - Artists can respond to reviews
  - Edit/delete responses
  - Response appears in a highlighted section
- **Helpful Count:**
  - Thumbs up button on each review
  - Shows helpful count
  - Users can mark reviews as helpful
- **Filter Options:**
  - "All Reviews" filter
  - "Verified Only" filter
- **Statistics:**
  - Average rating
  - Total reviews count
  - Verified reviews count
  - Response rate percentage

**For Artists:**
- When viewing your own profile, you'll see "Respond" buttons on client reviews
- Tap to add/edit responses to reviews

---

## 🗂️ File Structure Reference

### Frontend Components
```
erato-app/frontend/
├── components/
│   ├── FormBuilder.js          # Commission form builder UI
│   ├── DynamicForm.js          # Renders custom forms for clients
│   ├── ReferenceBoard.js       # Pinterest-style reference board
│   ├── VerificationBadge.js    # Badge display component
│   ├── VerificationProgress.js # Verification status component
│   ├── PaymentOptions.js       # Payment method selection
│   ├── StripeCheckout.js       # Stripe payment UI (placeholder)
│   ├── EscrowStatus.js         # Escrow status display
│   ├── MilestoneTracker.js     # Milestone payment tracker
│   ├── TipJar.js              # Tip artist component
│   ├── TransactionHistory.js   # Transaction list
│   ├── ReviewCard.js          # Individual review card
│   └── ReviewsSection.js      # Reviews list with filters
│
├── app/
│   ├── commission-packages.js  # Package management (includes FormBuilder)
│   ├── verification.js         # Verification submission screen
│   ├── messages/[id].js        # Commission conversation (includes References & Payment)
│   └── artist/[id].js          # Artist profile (includes Reviews)
```

### Backend Routes
```
erato-app/backend/src/routes/
├── commissionPackages.js       # Package CRUD (supports custom_form_fields)
├── references.js              # Reference management API
├── verification.js            # Verification submission API
├── payments.js                # Payment processing API
└── reviewEnhancements.js      # Review responses & helpful count API
```

---

## 🎯 Quick Access Guide

### For Artists:
1. **Manage Packages & Forms:** Profile → Packages Section → "Manage" → Create/Edit Package → "Build Form"
2. **View References:** Messages → Commission Conversation → "References" button (header)
3. **Submit Verification:** Navigate to `/verification` route
4. **Respond to Reviews:** Profile → Reviews Section → Tap "Respond" on any review

### For Clients:
1. **Fill Custom Forms:** When requesting a commission, you'll see the artist's custom form
2. **View References:** Messages → Commission Conversation → "References" button
3. **Make Payments:** Messages → Commission Conversation → Commission Details → Payment Options
4. **View Reviews:** Artist Profile → Scroll to Reviews Section
5. **Mark Reviews Helpful:** Artist Profile → Reviews → Tap thumbs up on reviews

---

## 🔧 Setup Notes

### Required Packages (Already Installed):
- ✅ `expo-image-picker` - For image uploads
- ✅ `expo-document-picker` - For file uploads (optional, not currently used)
- ✅ `react-native-toast-message` - For notifications
- ✅ All other dependencies are in `package.json`

### Optional (For Full Payment Processing):
- ⚠️ `@stripe/stripe-react-native` - Install this for full Stripe integration
  ```bash
  cd erato-app/frontend
  npx expo install @stripe/stripe-react-native
  ```
  Note: Payment UI is complete, but you'll need to install this for actual card processing.

---

## 📱 Testing the Features

### Test Commission Form Builder:
1. Log in as an artist
2. Go to `/commission-packages`
3. Create a new package
4. Scroll to "Custom Form Fields"
5. Tap "Build Form"
6. Add fields, reorder, set properties
7. Save and view the form in the preview

### Test Reference Board:
1. Start a commission conversation
2. Tap "References" button in header
3. Upload images, add links, create color palettes
4. Filter by type

### Test Payment System:
1. Create a commission request
2. Open the conversation
3. View commission details
4. Test payment options, escrow, milestones

### Test Reviews:
1. Complete a commission
2. Leave a review
3. View on artist profile
4. Test helpful button
5. (As artist) Respond to review

---

## 🐛 Troubleshooting

### DocumentPicker Error:
- **Fixed:** Removed unused `expo-document-picker` import from `verification.js`
- The app uses `expo-image-picker` for file uploads instead

### If features don't appear:
1. Make sure you're logged in with the correct user type (artist vs client)
2. Check that the backend is running
3. Verify API endpoints are accessible
4. Check browser/app console for errors

---

## 📝 Next Steps

All features are implemented and ready to use! The only optional step is:
- Installing `@stripe/stripe-react-native` for full payment processing (UI is complete, just needs the SDK)

Enjoy your fully-featured commission platform! 🎨



