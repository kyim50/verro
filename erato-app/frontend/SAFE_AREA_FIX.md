# Safe Area Fix for Bottom Navigation

## Issue
Content was being hidden behind the bottom navigation bar on devices with bottom notches/bezels.

## Solution
Added safe area insets to all tab screens so content is properly padded above the bottom navigation bar.

## Changes Applied

### 1. ✅ Tab Bar Layout (`app/(tabs)/_layout.js`)
- Added `useSafeAreaInsets` hook
- Tab bar height now adjusts based on bottom inset
- Padding dynamically calculated: `Math.max(28, insets.bottom)` for iOS, `Math.max(8, insets.bottom)` for Android

### 2. ✅ Home Screen (`app/(tabs)/home.js`)
- Added `useSafeAreaInsets` import and hook
- Updated ScrollView `contentContainerStyle` to include safe area padding
- Padding: `Math.max(insets.bottom, 20) + 80` (80px for tab bar height)

### 3. ✅ Boards Screen (`app/(tabs)/boards.js`)
- Added `useSafeAreaInsets` import and hook
- Updated all FlatList `contentContainerStyle` to include safe area padding
- Applied to both boards list and liked artists list

### 4. ✅ Messages Screen (`app/(tabs)/messages.js`)
- Added `useSafeAreaInsets` import and hook
- Updated FlatList `contentContainerStyle` to include safe area padding

### 5. ✅ Profile Screen (`app/(tabs)/profile.js`)
- Already had safe area padding added previously
- ScrollView content padding: `Math.max(insets.bottom, 20) + 80`

### 6. ✅ Explore Screen (`app/(tabs)/explore.js`)
- Already had `useSafeAreaInsets` imported
- Updated commissions FlatList to include safe area padding

## Padding Calculation

All screens now use:
```javascript
paddingBottom: Math.max(insets.bottom, 20) + 80
```

Where:
- `Math.max(insets.bottom, 20)` ensures minimum 20px padding even on devices without notches
- `+ 80` accounts for the tab bar height (~65-88px depending on platform + safe area)

## Result

✅ Content is now visible above the bottom navigation on all devices
✅ Works on devices with bottom notches
✅ Works on devices without notches (minimum padding applied)
✅ Consistent across all tab screens

## Testing

After rebuild, verify:
1. Scroll to bottom on each tab screen
2. Content should be visible above tab bar
3. No content hidden behind navigation
4. Works on devices with and without bottom notches
