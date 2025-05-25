import { useState, useEffect, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';
import toast from 'react-hot-toast';
import CourtGraphic from './CourtGraphic';
import PlayerTable from './PlayerTable';
import Image from 'next/image';

// Define proper types for the database relations
type Player = Database['public']['Tables']['players']['Row'];
type BookingPlayer = Database['public']['Tables']['booking_players']['Row'] & {
  players: Player | null;
};
type BookingWithPlayers = Database['public']['Tables']['bookings']['Row'] & {
  booking_players?: Pick<BookingPlayer, 'player_id'>[];
};

// Generate time slots from 7 AM to 10 PM
const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 7; // Start from 7 AM
  return {
    label: `${hour}:00`,
    value: `${hour.toString().padStart(2, '0')}:00`
  };
});

const BASE_COURT_RATE = 16; // £16 per player per court per hour

export default function BookingForm() {
  const [date, setDate] = useState<Date>(new Date());
  const [datesWithBookings, setDatesWithBookings] = useState<Date[]>([]);
  const [court1Active, setCourt1Active] = useState(false);
  const [court2Active, setCourt2Active] = useState(false);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [players, setPlayers] = useState<Array<{id?: string, name: string, courtFees: number | null, paid: boolean}>>([
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasExistingBooking, setHasExistingBooking] = useState(false);

  const resetForm = () => {
    setCourt1Active(false);
    setCourt2Active(false);
    setSelectedTimeSlots([]);
    setPlayers([
      { name: '', courtFees: null, paid: false },
      { name: '', courtFees: null, paid: false },
      { name: '', courtFees: null, paid: false },
      { name: '', courtFees: null, paid: false },
      { name: '', courtFees: null, paid: false },
      { name: '', courtFees: null, paid: false },
      { name: '', courtFees: null, paid: false },
      { name: '', courtFees: null, paid: false }
    ]);
  };

  const loadBookingsForDate = async (targetDate: Date) => {
    setIsLoading(true);
    try {
      // Get all bookings for this date
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_players (
            *,
            players (*)
          )
        `)
        .eq('booking_date', targetDate.toISOString().split('T')[0]);

      if (bookingsError) {
        console.error('Error loading bookings:', bookingsError);
        toast.error('Error loading bookings: ' + bookingsError.message);
        resetForm();
        return;
      }

      if (!bookings || bookings.length === 0) {
        setHasExistingBooking(false);
        resetForm();
        return;
      }

      setHasExistingBooking(true);

      // Process bookings
      const timeSlots = new Set<string>();
      const courts = new Set<number>();
      const playerMap = new Map<string, { id: string, name: string, courtFees: number | null, paid: boolean }>();

      // First pass: collect all time slots and courts
      bookings.forEach(booking => {
        const time = booking.start_time.slice(0, 5); // Get HH:MM format
        timeSlots.add(time);
        courts.add(booking.number_of_courts);
      });

      // Calculate total number of courts and hours
      const numberOfCourts = courts.size;
      const numberOfHours = timeSlots.size;

      // Second pass: process players and calculate their fees
      bookings.forEach((booking: Database['public']['Tables']['bookings']['Row'] & {
        booking_players?: Array<Database['public']['Tables']['booking_players']['Row'] & {
          players: Database['public']['Tables']['players']['Row'] | null;
        }>;
      }) => {
        booking.booking_players?.forEach((bp: Database['public']['Tables']['booking_players']['Row'] & {
          players: Database['public']['Tables']['players']['Row'] | null;
        }) => {
          if (bp.players) {
            const player = bp.players;
            // Only add player if not already in map (to avoid duplicates)
            if (!playerMap.has(player.id)) {
              playerMap.set(player.id, {
                id: player.id,
                name: player.name,
                courtFees: bp.amount_due,
                paid: bp.has_paid ?? false
              });
            }
          }
        });
      });

      // Get unique players
      const uniquePlayers = Array.from(playerMap.values());
      const numberOfPlayers = uniquePlayers.length;

      // Calculate court fees if there are players
      if (numberOfPlayers > 0) {
        // Calculate total court cost
        const totalCourtCost = BASE_COURT_RATE * numberOfCourts * numberOfHours;
        // Calculate per player cost
        const perPlayerCost = Math.ceil(totalCourtCost / numberOfPlayers);

        // Update player fees
        uniquePlayers.forEach(player => {
          player.courtFees = perPlayerCost;
        });
      }

      // Update state
      setSelectedTimeSlots(Array.from(timeSlots));
      setCourt1Active(courts.has(1));
      setCourt2Active(courts.has(2));

      // If we have existing bookings, show only those players
      if (numberOfPlayers > 0) {
        setPlayers(uniquePlayers);
      } else {
        // For new bookings, show 8 empty rows
        setPlayers([
          { name: '', courtFees: null, paid: false },
          { name: '', courtFees: null, paid: false },
          { name: '', courtFees: null, paid: false },
          { name: '', courtFees: null, paid: false },
          { name: '', courtFees: null, paid: false },
          { name: '', courtFees: null, paid: false },
          { name: '', courtFees: null, paid: false },
          { name: '', courtFees: null, paid: false }
        ]);
      }

    } catch (error) {
      console.error('Error loading bookings:', error);
      toast.error('Failed to load bookings');
      resetForm();
    } finally {
      setIsLoading(false);
    }
  };

  // Memoize loadBookingsForDate to fix the useEffect dependency warning
  const memoizedLoadBookingsForDate = useCallback(loadBookingsForDate, []);

  useEffect(() => {
    memoizedLoadBookingsForDate(date);
  }, [date, memoizedLoadBookingsForDate]);

  useEffect(() => {
    loadAllBookingDates();
  }, []);

  const loadAllBookingDates = async (targetDate: Date = new Date()) => {
    try {
      // Get the start and end of the month
      const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('booking_date')
        .gte('booking_date', startDate.toISOString().split('T')[0])
        .lte('booking_date', endDate.toISOString().split('T')[0])
        .order('booking_date');

      if (error) {
        console.error('Error loading booking dates:', error);
        return;
      }

      // Convert booking dates to Date objects
      const dates = bookings
        .map(booking => new Date(booking.booking_date))
        .filter((date, index, self) => 
          index === self.findIndex(d => d.toDateString() === date.toDateString())
        );

      setDatesWithBookings(dates);
    } catch (error) {
      console.error('Error loading booking dates:', error);
    }
  };

  const handlePrevDay = () => {
    const prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);
    setDate(prevDay);
  };

  const handleNextDay = () => {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    setDate(nextDay);
  };

  const toggleTimeSlot = (timeSlot: string) => {
    setSelectedTimeSlots(prev => 
      prev.includes(timeSlot)
        ? prev.filter(slot => slot !== timeSlot)
        : [...prev, timeSlot].sort()
    );
  };

  const handleCourtToggle = (isCourt1: boolean) => {
    if (isCourt1) {
      setCourt1Active(prev => !prev);
    } else {
      setCourt2Active(prev => !prev);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Validate inputs
      if (!selectedTimeSlots.length) {
        toast.error('Please select at least one time slot');
        return;
      }

      if (!court1Active && !court2Active) {
        toast.error('Please select at least one court');
        return;
      }

      const validPlayers = players.filter(p => p.name.trim() !== '');
      if (validPlayers.length === 0) {
        toast.error('Please add at least one player');
        return;
      }

      // Sort time slots for consistent ordering
      const sortedTimeSlots = [...selectedTimeSlots].sort();

      // Get existing bookings for these time slots
      const { data: existingBookings, error: bookingCheckError } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_players (
            player_id
          )
        `)
        .eq('booking_date', date.toISOString().split('T')[0])
        .in('start_time', sortedTimeSlots.map(time => time + ':00')); // Add seconds to match DB format

      if (bookingCheckError) {
        console.error('Error checking existing bookings:', bookingCheckError);
        toast.error('Error checking court availability');
        return;
      }

      // Process each time slot
      for (const timeSlot of sortedTimeSlots) {
        const existingBooking = existingBookings?.find(
          (booking: BookingWithPlayers) => booking.start_time.startsWith(timeSlot)
        );

        if (existingBooking) {
          // For existing bookings, just add the new players
          for (const player of validPlayers) {
            // Check if player is already in this booking
            const isPlayerInBooking = existingBooking.booking_players?.some(
              (bp: Pick<BookingPlayer, 'player_id'>) => bp.player_id === player.id
            );

            if (!isPlayerInBooking) {
              // Get or create player
              let playerId = player.id;
              if (!playerId) {
                // Check if player already exists by name
                const { data: existingPlayer } = await supabase
                  .from('players')
                  .select()
                  .ilike('name', player.name.trim())
                  .maybeSingle();

                if (existingPlayer) {
                  playerId = existingPlayer.id;
                } else {
                  // Create new player
                  const { data: newPlayer, error: createPlayerError } = await supabase
                    .from('players')
                    .insert([{ name: player.name.trim() }])
                    .select()
                    .single();

                  if (createPlayerError) {
                    console.error('Error creating player:', createPlayerError);
                    toast.error('Error creating player');
                    return;
                  }
                  playerId = newPlayer.id;
                }
              }

              // Add player to existing booking
              const { error: bookingPlayerError } = await supabase
                .from('booking_players')
                .insert([{
                  booking_id: existingBooking.id,
                  player_id: playerId,
                  amount_due: player.courtFees || 0,
                  has_paid: player.paid
                }]);

              if (bookingPlayerError) {
                console.error('Error creating booking_player:', bookingPlayerError);
                toast.error('Error linking player to booking');
                return;
              }
            }
          }
        } else {
          // Create new booking for this time slot
          const numberOfCourts = (court1Active && court2Active) ? 2 : 1;
          const courtNumber = court2Active ? 2 : 1;
          const totalPrice = BASE_COURT_RATE * numberOfCourts;

          // Create booking
          const { data: newBooking, error: bookingError } = await supabase
            .from('bookings')
            .insert([{
              booking_date: date.toISOString().split('T')[0],
              start_time: timeSlot + ':00',
              number_of_courts: courtNumber,
              duration_hours: 1,
              total_price: totalPrice
            }])
            .select()
            .single();

          if (bookingError) {
            console.error('Error creating booking:', bookingError);
            toast.error('Error creating booking');
            return;
          }

          // Add all players to the new booking
          for (const player of validPlayers) {
            let playerId = player.id;
            if (!playerId) {
              // Check if player already exists
              const { data: existingPlayer } = await supabase
                .from('players')
                .select()
                .ilike('name', player.name.trim())
                .maybeSingle();

              if (existingPlayer) {
                playerId = existingPlayer.id;
              } else {
                // Create new player
                const { data: newPlayer, error: createPlayerError } = await supabase
                  .from('players')
                  .insert([{ name: player.name.trim() }])
                  .select()
                  .single();

                if (createPlayerError) {
                  console.error('Error creating player:', createPlayerError);
                  toast.error('Error creating player');
                  return;
                }
                playerId = newPlayer.id;
              }
            }

            // Create booking_player record
            const { error: bookingPlayerError } = await supabase
              .from('booking_players')
              .insert([{
                booking_id: newBooking.id,
                player_id: playerId,
                amount_due: player.courtFees || 0,
                has_paid: player.paid
              }]);

            if (bookingPlayerError) {
              console.error('Error creating booking_player:', bookingPlayerError);
              toast.error('Error linking player to booking');
              return;
            }
          }
        }
      }

      toast.success('Booking saved successfully!');
      resetForm();
      // Reload the bookings to show the updates
      await loadBookingsForDate(date);
    } catch (error) {
      console.error('Error saving booking:', error);
      toast.error('Error saving booking');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    setIsLoading(true);
    try {
      // Get all bookings for this date
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .eq('booking_date', date.toISOString().split('T')[0]);

      if (bookingsError) {
        throw bookingsError;
      }

      if (!bookings || bookings.length === 0) {
        return;
      }

      const bookingIds = bookings.map(b => b.id);

      // Delete all booking_players entries for this player on this date
      const { error: deleteError } = await supabase
        .from('booking_players')
        .delete()
        .eq('player_id', playerId)
        .in('booking_id', bookingIds);

      if (deleteError) {
        throw deleteError;
      }

      // Reload the bookings to update the UI
      await loadBookingsForDate(date);
      toast.success('Player removed successfully');
    } catch (error) {
      console.error('Error removing player:', error);
      toast.error('Failed to remove player');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateCourtFees = (players: Array<{name: string, courtFees: number | null, paid: boolean}>) => {
    const activePlayers = players.filter(p => p.name.trim());
    if (activePlayers.length === 0) return players;

    const numberOfCourts = (court1Active ? 1 : 0) + (court2Active ? 1 : 0);
    if (numberOfCourts === 0) return players;

    const numberOfHours = selectedTimeSlots.length;
    if (numberOfHours === 0) return players;

    const totalCourtCost = BASE_COURT_RATE * numberOfCourts * numberOfHours;
    const perPlayerCost = Math.ceil(totalCourtCost / activePlayers.length);

    // Update court fees for all players, setting fees only for active players
    return players.map(player => ({
      ...player,
      courtFees: player.name.trim() ? perPlayerCost : null
    }));
  };

  return (
    <div className="relative max-w-6xl mx-auto p-6" data-testid="booking-form-container">
      {/* Page Title */}
      <h1 className="text-4xl font-bold text-center mb-8">Padel Tribe Court Booker</h1>

      {/* Navigation Bars */}
      <button
        onClick={handlePrevDay}
        className="fixed left-0 top-0 bottom-0 w-24 bg-black bg-opacity-80 hover:bg-opacity-90 transition-opacity flex items-center justify-center"
        style={{ clipPath: 'polygon(0 0, 50% 0, 100% 100%, 0 100%)' }}
        data-testid="prev-day-button"
      >
        <span className="sr-only">Previous Day</span>
        <div className="w-8 h-8 border-l-4 border-t-4 border-white transform -rotate-45 ml-8"></div>
      </button>

      <button
        onClick={handleNextDay}
        className="fixed right-0 top-0 bottom-0 w-24 bg-black bg-opacity-80 hover:bg-opacity-90 transition-opacity flex items-center justify-center"
        style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 0 100%)' }}
        data-testid="next-day-button"
      >
        <span className="sr-only">Next Day</span>
        <div className="w-8 h-8 border-r-4 border-t-4 border-white transform rotate-45 mr-8"></div>
      </button>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-black"></div>
        </div>
      )}

      <div className="flex gap-4 mb-8 items-start">
        {/* Logo */}
        <div className="w-[150px] h-[150px] relative shrink-0">
          <Image
            src="/logo.png"
            alt="Chapel-A Padel Tribe Logo"
            fill
            sizes="150px"
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>

        <div className="border-2 border-black shrink-0" data-testid="date-picker-container">
          <DatePicker
            selected={date}
            onChange={(newDate: Date | null) => newDate && setDate(newDate)}
            onMonthChange={loadAllBookingDates}
            inline
            calendarClassName="!border-none"
            dayClassName={date => 
              datesWithBookings.some(bookingDate => 
                bookingDate.toDateString() === date.toDateString()
              ) ? "bg-blue-100" : ""
            }
            highlightDates={datesWithBookings}
          />
        </div>

        <div className="flex-1 border-2 border-black p-4 min-h-[320px]" data-testid="time-slots-container">
          <h3 className="text-xl font-semibold mb-4">Available Time Slots</h3>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot.value}
                onClick={() => toggleTimeSlot(slot.value)}
                className={`p-2 border-2 border-black rounded ${
                  selectedTimeSlots.includes(slot.value) 
                    ? 'bg-blue-200' 
                    : 'hover:bg-gray-100'
                }`}
                data-testid={`time-slot-${slot.value}`}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-8 justify-center">
        <CourtGraphic
          isActive={court1Active}
          courtNumber={1}
          onClick={() => handleCourtToggle(true)}
        />

        <CourtGraphic
          isActive={court2Active}
          courtNumber={2}
          onClick={() => handleCourtToggle(false)}
        />
      </div>

      <PlayerTable 
        players={players}
        onPlayersChange={(newPlayers) => {
          setPlayers(calculateCourtFees(newPlayers));
        }}
        onRemoveExistingPlayer={handleRemovePlayer}
        isExistingBooking={hasExistingBooking}
      />

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          className="px-8 py-4 bg-blue-600 text-white text-xl font-semibold rounded hover:bg-blue-700 transition-colors"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Bookings'}
        </button>
      </div>
    </div>
  );
}