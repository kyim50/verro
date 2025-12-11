# Toast Message Styling

## Overview
All toast messages are now styled to match the app's dark theme with consistent design language.

## Design Features

### Visual Style
- **Background:** Dark surface (`#1a1a1a`) matching app theme
- **Border:** Colored left border (4px) indicating toast type
- **Icons:** Contextual icons for each toast type
- **Typography:** Matches app typography system
- **Shadows:** Large shadow for depth and elevation
- **Close Button:** Dismissible with close icon

### Toast Types

1. **Success Toast** (Green)
   - Icon: `checkmark-circle`
   - Border: Success green (`#00a400`)
   - Use for: Successful actions, confirmations

2. **Error Toast** (Red)
   - Icon: `close-circle`
   - Border: Error red (`#e60023` - Pinterest red)
   - Use for: Errors, failures, warnings

3. **Info Toast** (Blue)
   - Icon: `information-circle`
   - Border: Info blue (`#0099ff`)
   - Use for: Informational messages, progress updates

### Layout
- **Position:** Top of screen (60px offset for status bar)
- **Padding:** 16px horizontal, 8px top
- **Min Height:** 64px for consistent sizing
- **Border Radius:** 16px (large) matching app design
- **Spacing:** Consistent with app spacing system

### Typography
- **Title:** Bold, 15px, white (`#ffffff`)
- **Message:** Regular, 13px, secondary gray (`#b3b3b3`)
- **Line Height:** Optimized for readability

## Implementation

### Files Changed
1. `components/StyledToast.js` - Custom toast config with themed components
2. `app/_layout.js` - Applied toast config to Toast component

### Usage
All existing `Toast.show()` calls will automatically use the new styling:

```javascript
Toast.show({
  type: 'success', // or 'error', 'info'
  text1: 'Success',
  text2: 'Board created!',
  visibilityTime: 2000,
});
```

## Result

✅ All toast messages now match the dark theme
✅ Consistent styling across the app
✅ Clear visual hierarchy with icons and colors
✅ Professional, polished appearance
✅ Easy to dismiss with close button
