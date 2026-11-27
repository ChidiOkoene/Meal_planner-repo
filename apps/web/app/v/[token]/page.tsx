import type { Metadata } from 'next';
import { Placeholder } from '@/components/placeholder';

export const metadata: Metadata = { title: 'Order', robots: { index: false } };

export default function VendorOrderPage() {
  return (
    <Placeholder title="Order" issue="#31">
      Vendors will open this page from a WhatsApp link to confirm prices and upload a delivery
      photo.
    </Placeholder>
  );
}
