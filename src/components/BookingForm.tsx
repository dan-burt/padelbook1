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
      setPlayers(uniquePlayers);

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
        setTimeout(() => setPlayers(prev => calculateCourtFees(prev)), 0);
        return newValue;
      });
    } else {
      setCourt2Active(prev => {
        const newValue = !prev;
        // Recalculate fees after court toggle
        setTimeout(() => setPlayers(prev => calculateCourtFees(prev)), 0);
        return newValue;
      });
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!selectedTimeSlots.length) {
      toast.error('Please select at least one time slot');
      return;
    }

    if (!court1Active && !court2Active) {
      toast.error('Please select at least one court');
      return;
    }

    // Get all players that have names (both existing and new)
    const validPlayers = players.filter(p => p?.name && p.name.trim() !== '');
    if (!validPlayers.length) {
      toast.error('Please add at least one player');
      return;
    }

    // Separate new players (without IDs) from existing ones
    const newPlayers = validPlayers.filter(p => !p.id);
    const existingPlayers = validPlayers.filter(p => p.id);

    try {
      // Get selected courts
      const selectedCourts = [];
      if (court1Active) selectedCourts.push(1);
      if (court2Active) selectedCourts.push(2);

      // Create bookings for each court and time slot combination
      for (const courtNumber of selectedCourts) {
        for (const timeSlot of selectedTimeSlots) {
          // Create booking date by combining selected date with time slot
          const [hours] = timeSlot.split(':');
          const bookingDate = new Date(date);
          bookingDate.setHours(parseInt(hours), 0, 0, 0);

          console.log(`Checking bookings for court ${courtNumber} at ${timeSlot}`);

          // Check for existing bookings - removed inner join to avoid filtering
          const { data: existingBookings, error: checkError } = await supabase
            .from('bookings')
            .select('*')
            .eq('booking_date', bookingDate.toISOString().split('T')[0])
            .eq('start_time', `${timeSlot}:00`)
            .eq('number_of_courts', courtNumber)
            .single();

          if (checkError && checkError.code !== 'PGRST116') { // Ignore "no rows returned" error
            console.error('Error checking existing bookings:', checkError);
            toast.error(`Failed to check court ${courtNumber} at ${timeSlot}`);
            continue;
          }

          let bookingId;
          let existingPlayerIds = new Set<string>();
          
          if (existingBookings) {
            console.log('Found existing booking:', existingBookings);
            // Use existing booking
            bookingId = existingBookings.id;
            
            // Get existing player IDs to avoid duplicates
            const { data: currentPlayers, error: playersError } = await supabase
              .from('booking_players')
              .select('player_id')
              .eq('booking_id', bookingId);

            if (playersError) {
              console.error('Error fetching current players:', playersError);
              toast.error('Failed to fetch current players');
              continue;
            }

            existingPlayerIds = new Set(currentPlayers?.map(bp => bp.player_id) || []);
            console.log('Existing player IDs:', Array.from(existingPlayerIds));

            // Calculate new total price including all players
            const totalPlayers = newPlayers.length + existingPlayerIds.size;
            const perPlayerCost = calculatePerPlayerCost(totalPlayers);
            const newTotalPrice = perPlayerCost * totalPlayers;

            // Update total price for the booking
            const { error: updateError } = await supabase
              .from('bookings')
              .update({
                total_price: newTotalPrice
              })
              .eq('id', bookingId);

            if (updateError) {
              console.error('Error updating booking:', updateError);
              toast.error(`Failed to update booking for court ${courtNumber} at ${timeSlot}`);
              continue;
            }

            // Update existing players' amounts if they've changed
            for (const player of existingPlayers) {
              if (!player.id) continue;

              const { error: updatePlayerError } = await supabase
                .from('booking_players')
                .update({
                  amount_due: perPlayerCost,
                  has_paid: player.paid
                })
                .eq('booking_id', bookingId)
                .eq('player_id', player.id);

              if (updatePlayerError) {
                console.error('Error updating existing player:', updatePlayerError);
                toast.error(`Failed to update ${player.name}'s booking`);
              }
            }
          } else {
            console.log('Creating new booking');
            // Create new booking
            const perPlayerCost = calculatePerPlayerCost(validPlayers.length);
            const totalPrice = perPlayerCost * validPlayers.length;

            const { data: bookingData, error: bookingError } = await supabase
              .from('bookings')
              .insert({
                booking_date: bookingDate.toISOString().split('T')[0],
                start_time: `${timeSlot}:00`,
                duration_hours: 1,
                number_of_courts: courtNumber,
                total_price: totalPrice
              })
              .select()
              .single();

            if (bookingError) {
              console.error('Error creating booking:', bookingError);
              toast.error(`Failed to book court ${courtNumber} at ${timeSlot}`);
              continue;
            }

            bookingId = bookingData.id;
          }

          // Process each new player
          for (const player of newPlayers) {
            console.log('Processing player:', player.name);
            
            // First, check if a player with this name already exists
            const { data: existingPlayer, error: existingPlayerError } = await supabase
              .from('players')
              .select('*')
              .ilike('name', player.name)
              .single();

            let playerData;
            
            if (existingPlayer) {
              console.log('Found existing player:', existingPlayer);
              playerData = existingPlayer;
            } else {
              // Create new player if they don't exist
              const { data: newPlayerData, error: playerError } = await supabase
                .from('players')
                .insert({
                  name: player.name,
                  email: null
                })
                .select()
                .single();

              if (playerError) {
                console.error('Error creating player:', playerError);
                continue;
              }
              
              playerData = newPlayerData;
            }

            // Skip if player is already in the booking
            if (existingPlayerIds.has(playerData.id)) {
              console.log('Player already in booking:', player.name);
              continue;
            }

            // Calculate per player cost based on total players
            const totalPlayers = newPlayers.length + existingPlayerIds.size;
            const perPlayerCost = calculatePerPlayerCost(totalPlayers);

            // Add player to the booking
            const { error: bookingPlayerError } = await supabase
              .from('booking_players')
              .insert({
                booking_id: bookingId,
                player_id: playerData.id,
                has_paid: player.paid,
                amount_due: perPlayerCost
              });

            if (bookingPlayerError) {
              console.error('Error creating booking player:', bookingPlayerError);
              toast.error(`Failed to add ${player.name} to booking`);
              continue;
            }

            console.log('Successfully added player:', player.name);
          }

          const actionText = existingBookings ? 'Updated' : 'Created';
          toast.success(`${actionText} booking for court ${courtNumber} at ${timeSlot}`);
        }
      }

      // Reload the page to show updated bookings
      loadBookingsForDate(date);
    } catch (error) {
      console.error('Error saving bookings:', error);
      toast.error('Failed to save bookings');
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

  // Helper function to calculate per player cost
  const calculatePerPlayerCost = (totalPlayers: number) => {
    if (totalPlayers === 0) return 0;
    const numberOfCourts = (court1Active ? 1 : 0) + (court2Active ? 1 : 0);
    const numberOfHours = selectedTimeSlots.length;
    const totalCourtCost = BASE_COURT_RATE * numberOfCourts * numberOfHours;
    return Math.ceil(totalCourtCost / totalPlayers);
  };

  return (
    <div className="relative max-w-6xl mx-auto p-6" data-testid="booking-form-container">
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
        <button
          onClick={handleNewDay}
          className="px-6 py-4 border-2 border-black text-xl font-semibold hover:bg-gray-100 shrink-0"
          data-testid="new-day-button"
        >
          New Day
        </button>

        <div className="border-2 border-black shrink-0" data-testid="date-picker-container">
          <DatePicker
            selected={date}
            onChange={(date: Date | null) => date && setDate(date)}
            inline
            calendarClassName="!border-none"
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

      <div className="mb-8">
        <div className="px-6 py-4 border-2 border-black flex-grow" data-testid="selected-date-display">
          <span className="text-xl font-semibold">
            {date.toLocaleDateString('en-US', { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
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
          data-testid="save-bookings-button"
        >
          Save Bookings
        </button>
      </div>
    </div>
  );
} 