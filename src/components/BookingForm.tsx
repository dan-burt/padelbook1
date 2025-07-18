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
        
        // If number_of_courts is 2, both courts are booked
        if (booking.number_of_courts === 2) {
          courts.add(1);
          courts.add(2);
        } else {
          courts.add(booking.number_of_courts);
        }
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

      console.log('Fetching bookings for date range:', {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      });

      // Get all bookings for the month, regardless of number of courts
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .gte('booking_date', startDate.toISOString().split('T')[0])
        .lte('booking_date', endDate.toISOString().split('T')[0])
        .order('booking_date');

      if (error) {
        console.error('Error loading booking dates:', error);
        return;
      }

      console.log('All bookings:', bookings?.map(b => ({
        date: b.booking_date,
        time: b.start_time,
        courts: b.number_of_courts
      })));

      // Convert booking dates to Date objects and ensure uniqueness
      const uniqueDates = new Set(
        bookings
          .filter(booking => booking.booking_date !== null)
          .map(booking => booking.booking_date)
      );

      console.log('Unique dates:', Array.from(uniqueDates).sort());

      const dates = Array.from(uniqueDates).map(date => new Date(date));

      console.log('Final dates array:', dates.map(d => d.toISOString().split('T')[0]));
      console.log('Setting datesWithBookings to:', dates);

      setDatesWithBookings(dates);

      // Also update the calendar's highlighted dates
      const calendarDates = document.querySelectorAll('.react-datepicker__day');
      calendarDates.forEach(dateElement => {
        const dateString = dateElement.getAttribute('aria-label');
        if (dateString) {
          const date = new Date(dateString);
          const hasBooking = dates.some(bookingDate => 
            bookingDate.toDateString() === date.toDateString()
          );
          if (hasBooking) {
            dateElement.classList.add('bg-blue-100');
          }
        }
      });

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

      // Calculate the new number of courts
      const numberOfCourts = (court1Active && court2Active) ? 2 : (court1Active || court2Active ? 1 : 0);
      const totalPrice = BASE_COURT_RATE * numberOfCourts;

      // Process each time slot
      for (const timeSlot of sortedTimeSlots) {
        const existingBooking = existingBookings?.find(
          (booking: BookingWithPlayers) => booking.start_time.startsWith(timeSlot)
        );

        if (existingBooking) {
          // Update the existing booking with new court count
          const { error: updateError } = await supabase
            .from('bookings')
            .update({
              number_of_courts: numberOfCourts,
              total_price: totalPrice
            })
            .eq('id', existingBooking.id);

          if (updateError) {
            console.error('Error updating booking:', updateError);
            toast.error('Error updating booking');
            return;
          }

          // For existing bookings, just add any new players
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
          console.log('Creating booking with courts:', {
            court1Active,
            court2Active,
            numberOfCourts,
            date: date.toISOString().split('T')[0],
            timeSlot
          });

          // Create booking
          const { data: newBooking, error: bookingError } = await supabase
            .from('bookings')
            .insert([{
              booking_date: date.toISOString().split('T')[0],
              start_time: timeSlot + ':00',
              number_of_courts: numberOfCourts,
              duration_hours: 1,
              total_price: totalPrice
            }])
            .select()
            .single();

          console.log('Booking created:', newBooking);

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
      // Don't reset the form for existing bookings
      if (!hasExistingBooking) {
        resetForm();
      }
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
      const formattedDate = date.toISOString().split('T')[0];
      console.log('Removing player from bookings on date:', formattedDate);

      // Get all bookings for this date
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, booking_date')
        .eq('booking_date', formattedDate);

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      if (!bookings || bookings.length === 0) {
        console.log('No bookings found for date:', formattedDate);
        return;
      }

      console.log('Found bookings:', bookings);
      const bookingIds = bookings.map(b => b.id);

      // First, verify the booking_players records exist
      const { data: existingRecords, error: checkError } = await supabase
        .from('booking_players')
        .select('*')
        .eq('player_id', playerId)
        .in('booking_id', bookingIds);

      if (checkError) {
        console.error('Error checking booking_players:', checkError);
        throw checkError;
      }

      console.log('Found booking_players records:', existingRecords);

      if (!existingRecords || existingRecords.length === 0) {
        console.log('No booking_players records found to delete');
        return;
      }

      // Delete the booking_players entries one by one to ensure they're all deleted
      for (const record of existingRecords) {
        const { error: deleteError, data: deleteResult } = await supabase
          .from('booking_players')
          .delete()
          .eq('id', record.id)
          .select();

        if (deleteError) {
          console.error('Error deleting booking_player:', deleteError);
          throw deleteError;
        }

        console.log('Deleted booking_player:', deleteResult);
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

  const handleDeleteBooking = async () => {
    setIsLoading(true);
    try {
      const formattedDate = date.toISOString().split('T')[0];
      console.log('Attempting to delete bookings for date:', formattedDate);
      
      // Get all bookings for this date
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, booking_date, start_time')
        .eq('booking_date', formattedDate)
        .in('start_time', selectedTimeSlots.map(time => time + ':00'));

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        throw bookingsError;
      }

      if (!bookings || bookings.length === 0) {
        console.log('No bookings found to delete');
        return;
      }

      console.log('Found bookings to delete:', bookings);
      const bookingIds = bookings.map(b => b.id);

      // Delete all booking_players records first (foreign key constraint)
      const { data: deletedPlayers, error: bookingPlayersError } = await supabase
        .from('booking_players')
        .delete()
        .in('booking_id', bookingIds)
        .select();

      if (bookingPlayersError) {
        console.error('Error deleting booking_players:', bookingPlayersError);
        throw bookingPlayersError;
      }

      console.log('Successfully deleted booking_players:', deletedPlayers);

      // Then delete the bookings
      const { data: deletedBookings, error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .in('id', bookingIds)
        .select();

      if (deleteError) {
        console.error('Error deleting bookings:', deleteError);
        throw deleteError;
      }

      console.log('Successfully deleted bookings:', deletedBookings);

      toast.success('Booking deleted successfully');
      
      // Reset form first
      resetForm();
      
      // Then reload bookings with a slight delay to ensure DB consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      const { data: checkBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('booking_date', formattedDate);
      console.log('Remaining bookings after deletion:', checkBookings);
      
      await loadBookingsForDate(date);
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast.error('Failed to delete booking');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative max-w-6xl mx-auto p-2 sm:p-6" data-testid="booking-form-container">
      {/* Page Title */}
      <h1 className="text-2xl sm:text-4xl font-bold text-center mb-4 sm:mb-8">Padel Tribe Court Booker</h1>

      {/* Navigation Bars - Hidden on mobile */}
      <button
        onClick={handlePrevDay}
        className="hidden sm:flex fixed left-0 top-0 bottom-0 w-24 bg-black bg-opacity-80 hover:bg-opacity-90 transition-opacity items-center justify-center"
        style={{ clipPath: 'polygon(0 0, 50% 0, 100% 100%, 0 100%)' }}
        data-testid="prev-day-button"
      >
        <span className="sr-only">Previous Day</span>
        <div className="w-8 h-8 border-l-4 border-t-4 border-white transform -rotate-45 ml-8"></div>
      </button>

      <button
        onClick={handleNextDay}
        className="hidden sm:flex fixed right-0 top-0 bottom-0 w-24 bg-black bg-opacity-80 hover:bg-opacity-90 transition-opacity items-center justify-center"
        style={{ clipPath: 'polygon(50% 0, 100% 0, 100% 100%, 0 100%)' }}
        data-testid="next-day-button"
      >
        <span className="sr-only">Next Day</span>
        <div className="w-8 h-8 border-r-4 border-t-4 border-white transform rotate-45 mr-8"></div>
      </button>

      {/* Mobile Navigation */}
      <div className="flex sm:hidden justify-between mb-4">
        <button
          onClick={handlePrevDay}
          className="p-2 bg-black bg-opacity-80 hover:bg-opacity-90 rounded-lg"
        >
          <div className="w-6 h-6 border-l-4 border-t-4 border-white transform -rotate-45"></div>
        </button>
        <button
          onClick={handleNextDay}
          className="p-2 bg-black bg-opacity-80 hover:bg-opacity-90 rounded-lg"
        >
          <div className="w-6 h-6 border-r-4 border-t-4 border-white transform rotate-45"></div>
        </button>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-black"></div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-4 sm:mb-8 items-center sm:items-start">
        {/* Logo */}
        <div className="w-[150px] h-[150px] sm:w-[200px] sm:h-[200px] relative shrink-0">
          <Image
            src="/logo.png"
            alt="Chapel-A Padel Tribe Logo"
            fill
            sizes="(max-width: 640px) 150px, 200px"
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>

        <div className="w-full sm:w-auto" data-testid="date-picker-container">
          <div className="border-2 border-black mx-auto" style={{ width: 'fit-content' }}>
            <DatePicker
              selected={date}
              onChange={(newDate: Date | null) => newDate && setDate(newDate)}
              onMonthChange={loadAllBookingDates}
              inline
              calendarClassName="!border-none [&_.react-datepicker__day--highlighted]:!bg-emerald-500 [&_.react-datepicker__day--highlighted]:!text-white [&_.react-datepicker__day--highlighted:hover]:!bg-emerald-600"
              wrapperClassName="w-full"
              startDate={date}
              calendarStartDay={1}
              dayClassName={date => {
                const dateStr = date.toISOString().split('T')[0];
                const hasBooking = datesWithBookings.some(bookingDate => 
                  bookingDate.toISOString().split('T')[0] === dateStr
                );
                return hasBooking ? "react-datepicker__day--highlighted" : "";
              }}
              highlightDates={datesWithBookings}
            />
          </div>
        </div>

        <div className="w-full sm:flex-1 border-2 border-black p-2 sm:p-4 min-h-[200px] sm:min-h-[320px]" data-testid="time-slots-container">
          <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4">Available Time Slots</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot.value}
                onClick={() => toggleTimeSlot(slot.value)}
                className={`p-1 sm:p-2 border-2 border-black rounded text-sm sm:text-base ${
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

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-8 items-center justify-center">
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
        onDeleteBooking={handleDeleteBooking}
      />

      <div className="mt-4 sm:mt-8 flex justify-end">
        <button
          onClick={handleSave}
          className="w-full sm:w-auto px-4 sm:px-8 py-3 sm:py-4 bg-blue-600 text-white text-lg sm:text-xl font-semibold rounded hover:bg-blue-700 transition-colors"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Bookings'}
        </button>
      </div>

      {hasExistingBooking && (
        <div className="mt-4 sm:mt-8 flex justify-end">
          <button
            onClick={handleDeleteBooking}
            className="w-full sm:w-auto px-4 sm:px-8 py-3 sm:py-4 bg-red-600 text-white text-lg sm:text-xl font-semibold rounded hover:bg-red-700 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Booking'}
          </button>
        </div>
      )}
    </div>
  );
}