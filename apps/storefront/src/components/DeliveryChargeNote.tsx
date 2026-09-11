import { useEffect, useState } from "react";
import { formatPkr } from "../lib/products";
import { loadShopSettings } from "../lib/offers";

export default function DeliveryChargeNote({ apiBase }: { apiBase: string }) {
  const [deliveryPkr, setDeliveryPkr] = useState<number | null>(null);

  useEffect(() => {
    loadShopSettings(apiBase)
      .then((settings) => setDeliveryPkr(settings.deliveryPkr))
      .catch(() => setDeliveryPkr(250));
  }, [apiBase]);

  const charge =
    deliveryPkr == null
      ? "the current nationwide rate"
      : deliveryPkr === 0
        ? "free"
        : formatPkr(deliveryPkr);

  return (
    <p>
      Standard nationwide delivery is {charge}. Any free-delivery offer will be shown
      before checkout.
    </p>
  );
}
