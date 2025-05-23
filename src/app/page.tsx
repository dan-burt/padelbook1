'use client';

import BookingForm from '@/components/BookingForm';
import { Toaster } from 'react-hot-toast';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <Toaster position="top-right" />
      <BookingForm />
    </main>
  );
}
