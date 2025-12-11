# Board Pin Count Fix

## Issue
Board pin count doesn't update after adding artworks. Shows stale count (e.g., "1 Pin") even after adding more artworks.

## Root Cause
1. Board count was coming from cached backend response `item.artworks?.[0]?.count`
2. Boards list wasn't refreshing when returning from board detail page
3. Optimistic updates weren't properly updating the count

## Fixes Applied

### 1. ✅ Improved Count Calculation
**Before:**
```javascript
const artworkCount = item.artworks?.[0]?.count || 0;
```

**After:**
```javascript
// Prefer board_artworks array length (most accurate)
const countFromArray = item.board_artworks?.length || 0;
const countFromBackend = item.artworks?.[0]?.count;
const artworkCount = countFromArray > 0 ? countFromArray : (countFromBackend || 0);
```

### 2. ✅ Auto-Refresh Boards When Returning
Added `useFocusEffect` to refresh boards list when screen comes into focus:
```javascript
useFocusEffect(
  useCallback(() => {
    loadBoards(); // Always refresh when returning to boards screen
    // ...
  }, [activeTab, isArtistUser, token])
);
```

### 3. ✅ Optimistic Updates in Store
Enhanced `saveArtworkToBoard` to update board count optimistically:
- Updates `board_artworks` array
- Updates `artworks[0].count` 
- Updates both `boards` array and `currentBoard`

### 4. ✅ Refresh After Adding Artwork
Added board refresh after saving artwork:
- In `handleBoardSelect` - refreshes boards after adding
- In `handleCreateAndSave` - refreshes boards after creating and adding

### 5. ✅ Board Detail Page Refresh
Added `useFocusEffect` to board detail page to refresh when screen comes into focus

## Files Changed

1. `app/(tabs)/boards.js`
   - Added `useFocusEffect` to refresh boards on focus
   - Improved count calculation to prefer array length

2. `store/boardStore.js`
   - Enhanced `saveArtworkToBoard` with optimistic updates
   - Updates count from `board_artworks` array length

3. `app/(tabs)/home.js`
   - Added board refresh after `handleBoardSelect`
   - Added board refresh after `handleCreateAndSave`

4. `app/board/[id].js`
   - Added `useFocusEffect` to refresh board details on focus

## Testing

After rebuild, verify:

1. **Add Artwork to Board:**
   - Add artwork to existing board
   - Pin count should update immediately
   - Navigate to board detail → Should show correct count
   - Go back to library → Count should still be correct

2. **Create Board and Add:**
   - Create new board and add artwork
   - Count should show "1 Pin" immediately
   - Add another artwork → Count should update to "2 Pins"

3. **Refresh:**
   - Add artwork → Count updates
   - Pull to refresh → Count stays correct
   - Navigate away and back → Count stays correct

## Result

✅ Board pin count updates immediately when artworks are added
✅ Count persists after refresh
✅ Count is accurate when navigating between screens
✅ Uses most accurate source (board_artworks array length)
