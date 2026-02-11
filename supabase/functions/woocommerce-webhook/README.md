# WooCommerce Webhook Edge Function

Receives order status updates from WooCommerce and syncs them to the app.

## Environment Variables

Required in Supabase Edge Functions:
- `SUPABASE_URL` - Auto-provided
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided

## Deployment

```bash
supabase functions deploy woocommerce-webhook
```

## Webhook URL

After deployment, the webhook URL will be:
```
https://[your-project-ref].supabase.co/functions/v1/woocommerce-webhook
```

## Security

- Validates webhook signature using HMAC SHA256
- Only processes orders with `_revenda_app_order_id` meta field
- Uses service role key for database updates
