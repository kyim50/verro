# Milestone Payment Feature Documentation

## Overview

The milestone payment system allows commissions to be broken down into multiple payment stages tied to approval checkpoints, similar to VGen's workflow. This ensures clients pay for work incrementally as the artist progresses through different stages (Sketch, Line Art, Colors, Shading, etc.).

## Key Features

### 1. **Automatic Milestone Generation**
- When an artist accepts a commission, milestones are automatically generated based on templates
- Default stages: Sketch (25%), Line Art (25%), Base Colors (25%), Shading/Rendering (25%)
- Artists can customize milestone breakdown before client confirmation

### 2. **Payment-Before-Work Enforcement**
- Clients must pay for each milestone before the artist can start work on that stage
- Milestones are "locked" until the previous milestone is paid and approved
- Only the first milestone is unlocked initially

### 3. **Approval Checkpoint Integration**
- Each milestone is tied to an approval checkpoint
- When an artist completes a milestone stage, they upload work for client approval
- Client can approve or request revisions
- Work progresses to the next milestone only after approval

### 4. **Revision Fee Management**
- Each commission has a free revision limit (default: 2 revisions per milestone)
- Additional revisions beyond the limit incur fees
- Revision fees are automatically added to the current or next unpaid milestone
- Database triggers handle fee calculations automatically

### 5. **Hybrid Milestone Creation**
- Default templates auto-generate milestones on commission acceptance
- Artists can edit milestone details before client confirmation
- Client must confirm the milestone plan before payments can begin

## Database Schema

### New Tables

#### `commission_milestones`
```sql
- id (UUID, primary key)
- commission_id (UUID, references commissions)
- milestone_number (INTEGER) - Sequential order
- stage (VARCHAR) - 'sketch', 'line_art', 'base_colors', 'shading', 'final', 'custom'
- title (VARCHAR) - Display name
- description (TEXT) - Details about this milestone
- amount (DECIMAL) - Payment amount for this milestone
- percentage (DECIMAL) - Percentage of total commission price
- payment_status ('unpaid', 'pending', 'paid')
- payment_required_before_work (BOOLEAN) - Must be paid before artist starts
- due_date (TIMESTAMP)
- paid_at (TIMESTAMP)
- payment_transaction_id (UUID, references payment_transactions)
- progress_update_id (UUID, references commission_progress_updates)
- is_locked (BOOLEAN) - Locked until previous milestone completed
- revision_fee_added (DECIMAL) - Extra fees from revisions
```

#### `milestone_stage_templates`
```sql
- id (UUID, primary key)
- stage (VARCHAR, unique) - Template identifier
- display_name (VARCHAR) - Human-readable name
- default_percentage (DECIMAL) - Default % of commission price
- typical_order (INTEGER) - Display order
- description (TEXT) - What this stage involves
```

### Updated Tables

#### `commissions` (new fields)
```sql
- milestone_plan_confirmed (BOOLEAN) - Client approved milestone plan
- current_milestone_id (UUID) - Currently active milestone
- total_revision_fees (DECIMAL) - Accumulated revision fees
- max_revision_count (INTEGER) - Free revisions allowed (default: 2)
- current_revision_count (INTEGER) - Total revisions requested
- revision_fee_per_request (DECIMAL) - Fee for extra revisions
```

#### `commission_progress_updates` (new fields)
```sql
- milestone_id (UUID) - Links update to a milestone
- milestone_stage (VARCHAR) - Stage this update belongs to
```

## API Endpoints

### Milestone Management (`/api/milestones`)

#### `GET /milestones/templates`
Get available milestone stage templates.
- **Access**: Private (authenticated users)
- **Returns**: List of milestone templates

#### `POST /milestones/commission/:commissionId/generate`
Generate default milestones for a commission.
- **Access**: Private (Artist only)
- **Body**: None (uses templates)
- **Returns**: Created milestones array
- **Note**: Milestones can be edited before client confirmation

#### `GET /milestones/commission/:commissionId`
Get all milestones for a commission.
- **Access**: Private (Client or Artist)
- **Returns**: Milestones with payment and progress update details

#### `PUT /milestones/:milestoneId`
Update milestone details (before confirmation).
- **Access**: Private (Artist only)
- **Body**: `{ title, description, amount, percentage, stage }`
- **Note**: Only works before `milestone_plan_confirmed` is true

#### `POST /milestones/commission/:commissionId/confirm`
Client confirms the milestone payment plan.
- **Access**: Private (Client only)
- **Validates**: Milestones total 100%
- **Effect**: Locks milestone plan, enables payments

#### `POST /milestones/:milestoneId/start`
Artist marks a milestone as started.
- **Access**: Private (Artist only)
- **Requires**: Payment received (if `payment_required_before_work`)
- **Effect**: Sets as current milestone

#### `POST /milestones/:milestoneId/complete`
Artist completes a milestone and creates approval checkpoint.
- **Access**: Private (Artist only)
- **Body**: `{ image_url, notes, additional_images[] }`
- **Effect**: Creates progress update for client approval

#### `GET /milestones/:milestoneId/payment-status`
Check if a milestone can be paid.
- **Access**: Private (Client only)
- **Returns**: Payment eligibility and amount

### Payment Integration (`/api/payments`)

#### `POST /payments/create-order`
Updated to support milestone payments.
- **Body**: `{ commissionId, paymentType: 'milestone', milestoneId, amount? }`
- **Validates**: Milestone exists, not locked, not already paid
- **Returns**: PayPal order with approval URL

#### `POST /payments/capture-order`
Updated to mark milestone as paid after successful payment.
- **Automatically**: Updates milestone `payment_status` to 'paid'
- **Unlocks**: Next milestone in sequence

## Workflow

### 1. Commission Creation & Acceptance
```
Client → Request Commission
Artist → Accept Commission
System → Auto-generate Milestones (4 default stages)
Artist → (Optional) Edit milestone breakdown
Artist → Send milestone plan to client
```

### 2. Milestone Plan Confirmation
```
Client → Review milestone plan
Client → Confirm milestone plan
System → Lock milestone plan (no more edits)
System → Unlock first milestone for payment
```

### 3. Payment & Work Cycle (per milestone)
```
Client → Pay milestone (e.g., 25% for Sketch)
System → Mark milestone as paid
System → Unlock milestone for artist to work
Artist → Complete sketch work
Artist → Upload sketch for approval
System → Create approval checkpoint
Client → Review & Approve/Request Revisions

If Approved:
  System → Unlock next milestone
  Client → Pay next milestone
  (Cycle repeats)

If Revisions Requested:
  IF within free limit (0-2):
    Artist → Make changes → Re-upload
  ELSE (beyond limit):
    System → Add revision fee to current milestone
    Client → Pay additional fee (if unpaid milestone)
    Artist → Make changes → Re-upload
```

### 4. Revision Fee Calculation
```
Trigger: Client requests revision
Check: current_revision_count >= max_revision_count?

If YES (beyond free limit):
  fee = revision_fee_per_request (e.g., $10)

  Add fee to:
    - Current milestone (if unpaid)
    - OR next unpaid milestone

  Update: total_revision_fees += fee
  Update: current_revision_count += 1

  Client must pay updated amount before artist proceeds
```

### 5. Commission Completion
```
Artist → Complete final milestone
Artist → Upload final work for approval
Client → Approve final milestone
System → Mark commission as completed
System → Release escrow funds to artist
System → Prompt both parties for reviews
```

## Frontend Components

### `MilestoneTracker.js`
Main component for displaying milestone progress.

**Props**:
- `commissionId` - Commission ID
- `isClient` - Whether current user is the client
- `onPayMilestone` - Callback when client clicks "Pay Now"

**Features**:
- Displays all milestones with status (paid, unpaid, locked)
- Shows revision fees if applicable
- Links to progress updates/approval checkpoints
- "Pay Now" button for unlocked, unpaid milestones
- Visual indicators for locked milestones

**Usage**:
```jsx
<MilestoneTracker
  commissionId={commission.id}
  isClient={user.id === commission.client_id}
  onPayMilestone={handleMilestonePayment}
/>
```

## Database Triggers

### `lock_future_milestones()`
Automatically unlocks the next milestone when current is paid.
- **Trigger**: AFTER UPDATE OF payment_status ON commission_milestones
- **Action**: When milestone marked as 'paid', unlock next milestone_number

### `add_revision_fee_to_milestone()`
Adds revision fees when client requests revisions beyond free limit.
- **Trigger**: AFTER INSERT ON commission_progress_updates
- **Condition**: update_type = 'revision_request'
- **Action**:
  1. Check if current_revision_count >= max_revision_count
  2. If yes, add revision_fee_per_request to current/next unpaid milestone
  3. Increment current_revision_count
  4. Update total_revision_fees

## Migration

Run the database migration to set up the schema:
```sql
-- Location: /backend/migrations/create_milestone_payment_system.sql
```

This migration:
1. Creates `commission_milestones` table
2. Creates `milestone_stage_templates` table
3. Adds new fields to `commissions` and `commission_progress_updates`
4. Inserts default stage templates (Sketch, Line Art, Colors, Shading)
5. Sets up Row Level Security policies
6. Creates database triggers for automation

## Configuration

### Default Settings
```javascript
// In commission package or artist settings
{
  max_revision_count: 2,              // Free revisions per milestone
  revision_fee_per_request: 15.00,   // Fee for extra revisions
  payment_required_before_work: true, // Enforce payment before work
}
```

### Milestone Templates
Edit `/api/milestones/templates` or modify the database:
```sql
INSERT INTO milestone_stage_templates (stage, display_name, default_percentage, typical_order)
VALUES ('custom_stage', 'Custom Stage Name', 20.00, 5);
```

## Example User Flow

### Artist's Perspective
1. Receive commission request → Accept
2. System generates 4 milestones automatically
3. (Optional) Edit milestone amounts/percentages
4. Wait for client to confirm milestone plan
5. Wait for client to pay first milestone (Sketch - 25%)
6. Create sketch → Upload for approval
7. Client approves → Next milestone unlocked
8. Wait for client to pay second milestone (Line Art - 25%)
9. Create line art → Upload for approval
10. Continue until all milestones complete

### Client's Perspective
1. Request commission from artist
2. Artist accepts → Receive milestone payment plan
3. Review plan (4 stages, 25% each)
4. Confirm milestone plan
5. Pay first milestone ($25 if commission is $100)
6. Wait for artist to complete sketch
7. Review sketch → Approve or request changes
8. If revision needed (3rd revision): Pay additional fee
9. Pay next milestone after approval
10. Repeat until final delivery

## Testing

### Test Scenarios
1. **Basic Flow**: Commission → Accept → Generate Milestones → Confirm → Pay → Approve
2. **Milestone Editing**: Generate → Edit amounts → Client confirms edited plan
3. **Locked Milestones**: Try to pay milestone 2 before milestone 1 (should fail)
4. **Revision Fees**: Request 3+ revisions → Verify fee added to milestone
5. **Payment Enforcement**: Artist tries to start work before payment (should fail)

### API Testing
```bash
# Generate milestones
POST /api/milestones/commission/{id}/generate

# Get milestones
GET /api/milestones/commission/{id}

# Confirm plan
POST /api/milestones/commission/{id}/confirm

# Pay milestone
POST /api/payments/create-order
Body: { commissionId, paymentType: 'milestone', milestoneId }

# Complete milestone
POST /api/milestones/{milestoneId}/complete
Body: { image_url, notes }
```

## Future Enhancements

### Potential Features
1. **Custom Milestone Stages**: Artists can create fully custom stages beyond templates
2. **Milestone Due Dates**: Auto-calculate based on estimated delivery time
3. **Partial Payments**: Allow milestone to be split into smaller payments
4. **Milestone Disputes**: Formal dispute resolution for rejected work
5. **Bulk Milestone Actions**: Pay multiple milestones at once
6. **Milestone Notifications**: Email/push when milestone unlocked, paid, completed
7. **Analytics**: Track milestone completion rates, average time per stage

## Troubleshooting

### Common Issues

**Milestones not generating on commission acceptance**
- Ensure commission has `final_price` set
- Check that `milestone_stage_templates` table has data
- Verify artist accepted (status changed to 'in_progress')

**Client can't pay milestone**
- Check `is_locked` status
- Verify `milestone_plan_confirmed` is true
- Ensure previous milestones are paid

**Revision fees not applying**
- Check `current_revision_count` vs `max_revision_count`
- Verify `revision_fee_per_request` is set (> 0)
- Ensure progress update `update_type` = 'revision_request'

**Milestone won't unlock after payment**
- Check database trigger `lock_future_milestones` is active
- Verify payment_status changed to 'paid'
- Check next milestone exists (milestone_number + 1)

## Support

For issues or questions:
- Backend API: `/backend/src/routes/milestones.js`
- Frontend Component: `/frontend/components/MilestoneTracker.js`
- Database Schema: `/backend/migrations/create_milestone_payment_system.sql`

---

**Version**: 1.0.0
**Last Updated**: 2025-12-25
**Compatible With**: Verro v1.x
