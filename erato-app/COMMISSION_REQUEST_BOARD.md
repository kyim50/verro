# Commission Request Board - Quest Board System

A Pinterest/freelancer-style commission request system where clients post commission requests with fixed terms and artists can browse and apply to them.

## Overview

This system allows:
- **Clients** to post commission requests with all details upfront (description, budget, deadline, style preferences, references)
- **Artists** to browse a "quest board" of available requests and submit bids/applications
- **Clients** to review applications and choose one artist
- Once an artist is chosen, the request disappears from other artists' boards and converts to a regular commission

## Database Schema

### Tables Created

#### `commission_requests`
Stores client-posted commission requests.

**Columns:**
- `id` (UUID, PK): Request identifier
- `client_id` (UUID, FK → users): Client who posted the request
- `title` (VARCHAR): Request title
- `description` (TEXT): Detailed description
- `budget_min` (NUMERIC): Minimum budget
- `budget_max` (NUMERIC): Maximum budget
- `deadline` (TIMESTAMPTZ): When client needs it completed
- `preferred_styles` (TEXT[]): Array of style preferences/tags
- `reference_images` (TEXT[]): Array of reference image URLs
- `status` (VARCHAR): 'open', 'awarded', 'closed', 'cancelled'
- `awarded_to` (UUID, FK → users): Artist who was chosen
- `view_count` (INTEGER): Number of views
- `bid_count` (INTEGER): Number of bids (auto-updated via trigger)
- `created_at`, `updated_at`, `awarded_at`, `closed_at` (TIMESTAMPTZ): Timestamps

**Indexes:**
- On `client_id`, `status`, `created_at`, `awarded_to`
- GIN index on `preferred_styles` for array operations
- Filtered index on open requests for fast querying

#### `commission_request_bids`
Stores artist applications/bids on commission requests.

**Columns:**
- `id` (UUID, PK): Bid identifier
- `request_id` (UUID, FK → commission_requests): Request being bid on
- `artist_id` (UUID, FK → users): Artist submitting bid
- `bid_amount` (NUMERIC): Proposed price
- `estimated_delivery_days` (INTEGER): Estimated completion time
- `message` (TEXT): Artist's pitch to client
- `portfolio_samples` (TEXT[]): Links to relevant portfolio work
- `status` (VARCHAR): 'pending', 'accepted', 'rejected', 'withdrawn'
- `created_at`, `updated_at`, `reviewed_at` (TIMESTAMPTZ): Timestamps
- **Unique constraint** on `(request_id, artist_id)` - one bid per artist per request

**Indexes:**
- On `request_id`, `artist_id`, `status`, `created_at`

### Triggers & Functions

1. **`update_commission_request_bid_count()`**: Auto-increments/decrements `bid_count` when bids are added/removed
2. **`update_commission_request_timestamp()`**: Auto-updates `updated_at` timestamp
3. **`get_commission_requests_for_artist()`**: Returns filtered requests with smart sorting

## API Endpoints

### GET `/commission-requests`
Get all commission requests with filtering and sorting.

**Query Parameters:**
- `status` (string): 'open', 'awarded', 'closed', 'cancelled' (default: 'open')
- `limit` (int): Results per page (1-100, default: 20)
- `page` (int): Page number (default: 1)
- `budget_min` (float): Minimum budget filter
- `budget_max` (float): Maximum budget filter
- `sort_by` (string): Sorting method
  - `recent` (default): Most recent first
  - `budget_high`: Highest budget first
  - `budget_low`: Lowest budget first
  - `bids_low`: Fewest bids first (good for artists looking for less competition)
  - `deadline_soon`: Soonest deadline first
- `styles` (string): Comma-separated style IDs to filter by

**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "client_id": "uuid",
      "title": "Character design for indie game",
      "description": "Looking for anime-style character...",
      "budget_min": 100,
      "budget_max": 300,
      "deadline": "2025-01-15T00:00:00Z",
      "preferred_styles": ["anime", "character-design"],
      "reference_images": ["url1", "url2"],
      "status": "open",
      "view_count": 45,
      "bid_count": 7,
      "created_at": "2025-01-01T12:00:00Z",
      "client": {
        "id": "uuid",
        "username": "john_doe",
        "avatar_url": "url",
        "full_name": "John Doe"
      },
      "has_applied": false,  // Only present for authenticated artists
      "user_bid_status": null  // 'pending', 'accepted', 'rejected' if artist has bid
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "total_pages": 3
  },
  "filters": {
    "status": "open",
    "budget_min": null,
    "budget_max": null,
    "sort_by": "recent",
    "styles": null
  }
}
```

### GET `/commission-requests/:id`
Get a single commission request with all bids (for clients) or basic info (for artists).

**Response:**
```json
{
  "id": "uuid",
  "client_id": "uuid",
  "title": "Character design",
  "description": "...",
  "budget_min": 100,
  "budget_max": 300,
  "deadline": "2025-01-15T00:00:00Z",
  "preferred_styles": ["anime"],
  "reference_images": ["url1"],
  "status": "open",
  "view_count": 46,
  "bid_count": 7,
  "client": { ... },
  "bids": [  // Only visible to request creator
    {
      "id": "uuid",
      "artist_id": "uuid",
      "bid_amount": 250,
      "estimated_delivery_days": 14,
      "message": "I'd love to work on this...",
      "portfolio_samples": ["url1"],
      "status": "pending",
      "created_at": "2025-01-02T10:00:00Z",
      "artist": {
        "id": "uuid",
        "username": "artist_name",
        "avatar_url": "url",
        "full_name": "Artist Name"
      }
    }
  ]
}
```

### POST `/commission-requests`
Create a new commission request (clients only).

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "title": "Character design for indie game",
  "description": "I'm looking for an anime-style character design...",
  "budget_min": 100,
  "budget_max": 300,
  "deadline": "2025-01-15T00:00:00Z",
  "preferred_styles": ["style-id-1", "style-id-2"],
  "reference_images": ["https://url1.com", "https://url2.com"]
}
```

**Validation:**
- `title`: 5-200 characters (required)
- `description`: min 20 characters (required)
- `budget_min`, `budget_max`: positive numbers (optional)
- `deadline`: ISO8601 date string (optional)
- `preferred_styles`: array of style IDs (optional)
- `reference_images`: array of URLs (optional)

**Response:** Created request object with client info

**Notifications:**
- Artists whose styles match `preferred_styles` receive notification

### POST `/commission-requests/:id/bids`
Submit a bid on a commission request (artists only).

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "bid_amount": 250,
  "estimated_delivery_days": 14,
  "message": "I'd love to work on this project. I have experience with...",
  "portfolio_samples": ["https://portfolio1.com", "https://portfolio2.com"]
}
```

**Validation:**
- `bid_amount`: positive number (required)
- `estimated_delivery_days`: positive integer (optional)
- `message`: max 1000 characters (optional)
- `portfolio_samples`: array of URLs (optional)

**Rules:**
- One bid per artist per request
- Request must be 'open' status
- Artist cannot bid on their own request

**Response:** Created bid object

**Notifications:**
- Client receives notification about new bid

### PATCH `/commission-requests/:id/bids/:bidId/accept`
Accept a bid and create a commission (clients only).

**Headers:** `Authorization: Bearer <token>`

**Workflow:**
1. Validates that user is the request creator
2. Accepts the selected bid
3. Rejects all other pending bids
4. Updates request status to 'awarded'
5. **Creates a commission** in the `commissions` table
6. Creates or finds existing conversation between client and artist
7. Notifies accepted artist (with commission ID)
8. Notifies rejected artists

**Response:**
```json
{
  "message": "Bid accepted successfully",
  "commission_id": "uuid",
  "conversation_id": "uuid"
}
```

### PATCH `/commission-requests/:id/bids/:bidId/withdraw`
Withdraw a bid (artists only).

**Headers:** `Authorization: Bearer <token>`

**Rules:**
- Only pending bids can be withdrawn
- Artist can only withdraw their own bids

**Response:**
```json
{
  "message": "Bid withdrawn successfully"
}
```

### GET `/commission-requests/bids/my`
Get all bids submitted by the authenticated artist.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "bids": [
    {
      "id": "uuid",
      "request_id": "uuid",
      "bid_amount": 250,
      "estimated_delivery_days": 14,
      "message": "...",
      "status": "pending",
      "created_at": "2025-01-02T10:00:00Z",
      "request": {
        "id": "uuid",
        "title": "Character design",
        "description": "...",
        "status": "open",
        "budget_min": 100,
        "budget_max": 300,
        "deadline": "2025-01-15T00:00:00Z",
        "client": { ... }
      }
    }
  ]
}
```

### GET `/commission-requests/my-requests`
Get all commission requests posted by the authenticated client.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "title": "Character design",
      "description": "...",
      "status": "open",
      "bid_count": 7,
      "pending_bids_count": 5,
      "total_bids_count": 7,
      "created_at": "2025-01-01T12:00:00Z",
      "bids": [
        {
          "id": "uuid",
          "artist_id": "uuid",
          "bid_amount": 250,
          "status": "pending",
          "artist": { ... }
        }
      ]
    }
  ]
}
```

### PATCH `/commission-requests/:id/cancel`
Cancel a commission request (clients only).

**Headers:** `Authorization: Bearer <token>`

**Workflow:**
1. Updates request status to 'cancelled'
2. Rejects all pending bids
3. Notifies all artists who had pending bids

**Rules:**
- Only 'open' requests can be cancelled
- Only request creator can cancel

**Response:**
```json
{
  "message": "Request cancelled successfully"
}
```

## Frontend Implementation

### For Artists

**Quest Board Screen** ([commission-requests.js](erato-app/frontend/app/commission-requests.js)):

1. **Filter UI**
   - Filter button in header with badge indicator
   - Active filters shown as chips below header
   - Filter modal with:
     - Sort options (Recent, Highest Budget, Lowest Budget, Fewest Bids, Deadline Soon)
     - Budget range inputs (min/max)
     - Style checkboxes
     - Clear All and Apply Filters buttons

2. **Request Cards**
   - Shows client info, title, description
   - Budget range and deadline
   - Reference images (first 3)
   - Bid count
   - "Applied" badge if artist already bid

3. **Bid Submission**
   - Modal with request preview
   - Bid amount input (required)
   - Estimated delivery days (optional)
   - Message/pitch to client (optional)
   - Portfolio samples (optional)

4. **My Bids View** (not yet implemented)
   - List of all artist's submitted bids
   - Shows request title, status, bid amount
   - Can withdraw pending bids

### For Clients

**Request Creation Modal**:
- Title and description inputs
- Budget range (min/max)
- Deadline picker
- Style selection (multi-select chips)
- Reference image upload (multiple)
- Post button

**My Requests View** (not yet implemented):
- List of client's posted requests
- Shows status, bid counts
- View and manage bids
- Accept/reject bid buttons
- Cancel request button

## Workflow Example

1. **Client posts request**
   ```
   POST /commission-requests
   {
     "title": "Anime character for VTuber model",
     "description": "Need full-body anime character design...",
     "budget_min": 200,
     "budget_max": 400,
     "preferred_styles": ["anime", "character-design"],
     "reference_images": ["ref1.jpg", "ref2.jpg"],
     "deadline": "2025-02-01"
   }
   ```

2. **Artists see it on quest board**
   - Filtered by their preferred styles
   - Sorted by chosen criteria
   - Can see how many other artists have bid

3. **Artist submits bid**
   ```
   POST /commission-requests/{id}/bids
   {
     "bid_amount": 350,
     "estimated_delivery_days": 14,
     "message": "I specialize in anime art with 5+ years experience...",
     "portfolio_samples": ["portfolio.com/work1", "portfolio.com/work2"]
   }
   ```

4. **Client reviews bids**
   ```
   GET /commission-requests/my-requests
   // Shows all their requests with bid counts

   GET /commission-requests/{id}
   // Shows full request with all bids
   ```

5. **Client accepts a bid**
   ```
   PATCH /commission-requests/{id}/bids/{bidId}/accept
   ```

   **This automatically:**
   - Creates a commission in `commissions` table
   - Creates/finds conversation between client and artist
   - Changes request status to 'awarded'
   - Hides request from all other artists
   - Rejects other pending bids
   - Notifies accepted artist with commission ID
   - Artist and client can now proceed with regular commission workflow

6. **Commission proceeds**
   - Commission now appears in both users' commission lists
   - They can chat in the conversation
   - Artist can send progress updates
   - Client can approve/request revisions
   - Standard commission workflow continues

## Migration Instructions

1. **Run the migration**:
   ```sql
   -- Execute the migration file
   \i erato-app/backend/database/migrations/add_commission_request_board.sql
   ```

2. **Verify tables created**:
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('commission_requests', 'commission_request_bids');
   ```

3. **Test the functions**:
   ```sql
   -- Test the filter function
   SELECT * FROM get_commission_requests_for_artist(
     'artist-uuid',
     NULL,
     NULL,
     ARRAY['anime', 'character-design'],
     'recent'
   );
   ```

## Future Enhancements

- [ ] Add deadline notifications (remind client X days before deadline)
- [ ] Add "Featured" or "Urgent" badges for requests
- [ ] Allow clients to set bid deadline separate from project deadline
- [ ] Add automatic request closure after X days of inactivity
- [ ] Add request analytics (views over time, average bid amount, etc.)
- [ ] Add ability for clients to message artists before accepting bid
- [ ] Add reputation/rating system for both clients and artists
- [ ] Add escrow/payment integration
- [ ] Add "Similar Requests" recommendations for artists
- [ ] Add saved searches/filters for artists

## Notes

- The system is designed to prevent spam bidding (one bid per artist per request)
- View count increments automatically when viewing request details
- Bid count updates automatically via database trigger
- Request disappears from artist boards once awarded
- All notifications use the existing notification system
- The system integrates seamlessly with the existing commission workflow
