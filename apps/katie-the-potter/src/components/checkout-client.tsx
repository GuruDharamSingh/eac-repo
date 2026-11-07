"use client";

import { CheckoutForm, type CheckoutFormProps } from "@elkdonis/checkout/components";
import { placeOrder } from "@/lib/shop-actions";

/**
 * The shared CheckoutForm, bound to our placeOrder action. A server action's
 * thrown Error reaches the browser with its message stripped in production,
 * so placeOrder RETURNS { ok: false, message } for anything a buyer should
 * read; this wrapper rethrows that as an Error client-side, which is the
 * channel CheckoutForm already shows ("err") under the form.
 * On success placeOrder redirects (to Stripe's page, or to /orders/<id>).
 */
export function CheckoutClient(props: Pick<CheckoutFormProps, "initialValues" | "paymentMethods" | "submitLabel">) {
  return (
    <CheckoutForm
      {...props}
      className="ktp-checkout-form"
      onSubmit={async (values) => {
        const result = await placeOrder(values);
        if (result && !result.ok) throw new Error(result.message);
      }}
    />
  );
}
