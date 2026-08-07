export interface CoachingSlotResponse {
  id: string;
  startsAt: string;
  endsAt: string;
}

export interface CoachingAvailabilityResponse {
  slots: CoachingSlotResponse[];
}

export interface CoachingBookingResponse {
  id: string;
  tier: string;
  status: 'awaiting_payment' | 'confirmed' | 'cancelled';
  priceCents: number;
}

export interface CreateBookingResponse {
  id: string;
  tier: string;
  status: 'awaiting_payment' | 'confirmed';
  checkoutUrl: string | null;
}
