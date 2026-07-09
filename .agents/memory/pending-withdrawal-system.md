---
name: Pending Withdrawal System
description: How the pending withdrawal flow works — separate from direct transactions
---

# Pending Withdrawal System

## The rule
Withdrawals go to a `pending_withdrawals` table (status: pending/confirmed/rejected). Balance is NOT deducted at request time. Admin must confirm or reject via admin panel.

**Why:** User asked for an admin-gated pending approval flow separate from the gas-fee gate.

**How to apply:**
- Frontend: `POST /api/withdrawals/request` — never call `POST /api/transactions` for user-initiated withdrawals
- On confirm: balance deducted + Transaction added + notification sent
- On reject: Transaction with type="Withdrawal Rejected" + message stored + notification sent
- Overcommit guard: `request_withdrawal` checks `wallet_balance - sum(pending amounts)` before accepting

## Admin auth
All `/api/admin/*` endpoints use `Depends(require_admin)` which checks `X-Username == ADMIN_USERNAME`. The admin user is env-based, not in the DB.

## Notification types
- `deposit` — regular deposit credited
- `withdrawal_confirmed` — admin confirmed a pending withdrawal
- `withdrawal_rejected` — admin rejected with reason
UserWalletView renders a different modal per `notif_type`.

## History display
AssetDetailsView merges:
1. `Transaction` records (type=Deposit/Withdrawal/Withdrawal Rejected/Deduction)
2. `PendingWithdrawal` records with status=`pending` (shown as "Pending" with clock icon)
Refresh interval re-fetches both every 15 seconds.
