-- One-time, idempotent cleanup for the 2026-09-11 payment retirement.
-- Existing transaction rows are retained while all account entitlements become free.

update public.user_usage_quotas
set plan_tier = 'free',
    updated_at = now()
where plan_tier <> 'free';

update public.billing_subscriptions
set status = 'expired',
    plan_tier = 'free',
    cancel_at_period_end = false,
    updated_at = now()
where provider = 'apple'
  and status in ('active', 'trialing')
  and current_period_end is not null
  and current_period_end < now();

update public.billing_subscriptions
set status = 'checkout_canceled',
    plan_tier = 'free',
    cancel_at_period_end = false,
    updated_at = now()
where status in ('checkout_pending', 'billing_key_issued');

notify pgrst, 'reload schema';
