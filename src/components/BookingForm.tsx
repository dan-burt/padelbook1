import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';
import { Switch } from '@headlessui/react';
import toast from 'react-hot-toast';
import CourtGraphic from './CourtGraphic';
import PlayerTable from './PlayerTable';

type Player = Database['public']['Tables']['players']['Row'];
type Court = Database['public']['Tables']['courts']['Row'];
type Booking = Database['public']['Tables']['bookings']['Row'];

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

  useEffect(() => {
    loadBookingsForDate(date);
  }, [date]);

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
      bookings.forEach(booking => {
        booking.booking_players?.forEach((bp: any) => {
          if (bp?.players) {
            const player = bp.players;
            // Only add player if not already in map (to avoid duplicates)
            if (!playerMap.has(player.id)) {
              playerMap.set(player.id, {
                id: player.id,
                name: player.name,
                courtFees: bp.amount_due,
                paid: bp.has_paid
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
        let perPlayerCost = totalCourtCost / numberOfPlayers;
        // Round up to nearest whole number
        perPlayerCost = Math.ceil(perPlayerCost);

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

  const handleNewDay = () => {
    setDate(new Date());
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

  const calculateCourtFees = (players: Array<{name: string, courtFees: number | null, paid: boolean}>) => {
    // Only count players with names
    const validPlayers = players.filter(p => p.name.trim() !== '');
    const numberOfPlayers = validPlayers.length;
    
    if (numberOfPlayers === 0) return players;

    // Count selected courts and hours
    const numberOfCourts = (court1Active ? 1 : 0) + (court2Active ? 1 : 0);
    const numberOfHours = selectedTimeSlots.length;
    
    // Calculate total court cost
    const totalCourtCost = BASE_COURT_RATE * numberOfCourts * numberOfHours;
    
    // Calculate per player cost with discount for more than 4 players
    let perPlayerCost = totalCourtCost / numberOfPlayers;
    
    // Round up to nearest whole number
    perPlayerCost = Math.ceil(perPlayerCost);

    // Update court fees for players with names
    return players.map(player => ({
      ...player,
      courtFees: player.name.trim() !== '' ? perPlayerCost : null
    }));
  };

  const handlePlayerNameChange = (index: number, name: string) => {
    const newPlayers = [...players];
    newPlayers[index] = { ...players[index], name };
    setPlayers(calculateCourtFees(newPlayers));
  };

  const toggleTimeSlot = (timeSlot: string) => {
    setSelectedTimeSlots(prev => {
      const newTimeSlots = prev.includes(timeSlot) 
        ? prev.filter(t => t !== timeSlot)
        : [...prev, timeSlot];
      
      // Recalculate fees after time slot change
      setPlayers(prev => calculateCourtFees(prev));
      return newTimeSlots;
    });
  };

  const handleCourtToggle = (isFirstCourt: boolean) => {
    if (isFirstCourt) {
      setCourt1Active(prev => {
        const newValue = !prev;
        // Recalculate fees after court toggle
        setPlayers(prevPlayers => calculateCourtFees(prevPlayers));
        return newValue;
      });
    } else {
      setCourt2Active(prev => {
        const newValue = !prev;
        // Recalculate fees after court toggle
        setPlayers(prevPlayers => calculateCourtFees(prevPlayers));
        return newValue;
      });
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

      // Check if any of these courts are already booked for the selected time slots
      const { data: existingBookings, error: bookingCheckError } = await supabase
        .from('bookings')
        .select('*')
        .eq('booking_date', date.toISOString().split('T')[0])
        .in('start_time', sortedTimeSlots);

      if (bookingCheckError) {
        console.error('Error checking existing bookings:', bookingCheckError);
        toast.error('Error checking court availability');
        return;
      }

      // Check for conflicts
      for (const booking of existingBookings || []) {
        if (court1Active && booking.number_of_courts === 1) {
          toast.error(`Court 1 is already booked at ${booking.start_time}`);
          return;
        }
        if (court2Active && booking.number_of_courts === 2) {
          toast.error(`Court 2 is already booked at ${booking.start_time}`);
          return;
        }
      }

      // Create bookings for each time slot
      for (const timeSlot of sortedTimeSlots) {
        // Create booking
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .insert([{
            booking_date: date.toISOString().split('T')[0],
            start_time: timeSlot,
            number_of_courts: court2Active ? 2 : 1
          }])
          .select()
          .single();

        if (bookingError) {
          console.error('Error creating booking:', bookingError);
          toast.error('Error creating booking');
          return;
        }

        // For each player with a name, create or get player record and create booking_player record
        for (const player of validPlayers) {
          // First, check if player already exists
          let { data: existingPlayer, error: playerError } = await supabase
            .from('players')
            .select()
            .ilike('name', player.name.trim())
            .maybeSingle();

          if (playerError) {
            console.error('Error checking existing player:', playerError);
            toast.error('Error processing player data');
            return;
          }

          let playerId;

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

          // Create booking_player record
          const { error: bookingPlayerError } = await supabase
            .from('booking_players')
            .insert([{
              booking_id: booking.id,
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

      toast.success('Booking saved successfully!');
      resetForm();
    } catch (error) {
      console.error('Error saving booking:', error);
      toast.error('Error saving booking');
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePerPlayerCost = (totalPlayers: number) => {
    if (totalPlayers === 0) return 0;
    const numberOfCourts = (court1Active ? 1 : 0) + (court2Active ? 1 : 0);
    const numberOfHours = selectedTimeSlots.length;
    const totalCourtCost = BASE_COURT_RATE * numberOfCourts * numberOfHours;
    return Math.ceil(totalCourtCost / totalPlayers);
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

  const handlePaidToggle = (index: number) => {
    const newPlayers = [...players];
    newPlayers[index] = { ...players[index], paid: !players[index].paid };
    setPlayers(newPlayers);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between space-x-4">
        <button
          onClick={handlePrevDay}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Previous Day
        </button>
        <DatePicker
          selected={date}
          onChange={(newDate: Date | null) => newDate && setDate(newDate)}
          inline
          calendarClassName="!border-none"
        />
        <button
          onClick={handleNextDay}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Next Day
        </button>
        <button
          onClick={handleNewDay}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Court Selection</h2>
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
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Time Slots</h2>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map(slot => (
              <button
                key={slot.value}
                onClick={() => toggleTimeSlot(slot.value)}
                className={`p-2 rounded ${
                  selectedTimeSlots.includes(slot.value)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Players</h2>
        <PlayerTable
          players={players}
          onPlayersChange={(newPlayers) => {
            setPlayers(calculateCourtFees(newPlayers));
          }}
          onRemoveExistingPlayer={handleRemovePlayer}
          isExistingBooking={hasExistingBooking}
        />
      </div>

      <div className="flex justify-end space-x-4">
        <button
          onClick={resetForm}
          className="px-6 py-2 bg-gray-200 rounded hover:bg-gray-300"
          disabled={isLoading}
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Booking'}
        </button>
      </div>
    </div>
  );
}