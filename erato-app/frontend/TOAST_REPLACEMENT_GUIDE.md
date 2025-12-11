# Toast to StyledAlert Replacement Guide

All Toast.show calls need to be replaced with showAlert calls.

## Pattern:
Replace:
```javascript
Toast.show({
  type: 'success', // or 'error', 'info'
  text1: 'Title',
  text2: 'Message',
  visibilityTime: 2000,
});
```

With:
```javascript
showAlert({
  title: 'Title',
  message: 'Message',
  type: 'success', // or 'error', 'info'
});
```

## Files Updated:
- ✅ app/(tabs)/home.js
- ✅ app/(tabs)/boards.js  
- ✅ app/(tabs)/explore.js (import added)

## Files Still Need Updates:
- app/(tabs)/profile.js
- app/(tabs)/messages.js
- app/profile/edit.js
- app/profile/edit-portfolio.js
- app/profile/edit-artist.js
- app/artwork/[id].js
- app/artwork/upload.js
- app/artist/[id].js
- app/client/[id].js
- app/messages/[id].js
- app/commission/create.js
- app/onboarding/portfolio.js
- app/auth/profile-picture.js
- components/ReviewModal.js

## Import Required:
Add to each file:
```javascript
import { showAlert } from '../../components/StyledAlert'; // adjust path as needed
```
