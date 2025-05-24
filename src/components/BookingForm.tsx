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
  const [players, setPlayers] = useState<Array<{name: string, courtFees: number | null, paid: boolean}>>([
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false },
    { name: '', courtFees: null, paid: false }
  ]);
  const [isLoading, setIsLoading] = useState(false);

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
        resetForm();
        return;
      }

      // Process bookings
      const timeSlots = new Set<string>();
      const courts = new Set<number>();
      const playerMap = new Map<string, { name: string, courtFees: number | null, paid: boolean }>();

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

      // Update players list with calculated fees
      setPlayers([
        ...uniquePlayers,
        ...Array(6 - uniquePlayers.length).fill({ name: '', courtFees: null, paid: false })
      ]);

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

    const validPlayers = players.filter(p => p?.name && p.name.trim() !== '');
    if (!validPlayers.length) {
      toast.error('Please add at least one player');
      return;
    }

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

          // Check for existing bookings
          const { data: existingBookings, error: checkError } = await supabase
            .from('bookings')
            .select('*')
            .eq('booking_date', bookingDate.toISOString().split('T')[0])
            .eq('start_time', `${timeSlot}:00`)
            .eq('number_of_courts', courtNumber);

          if (checkError) {
            console.error('Error checking existing bookings:', checkError);
            toast.error(`Failed to check court ${courtNumber} at ${timeSlot}`);
            continue;
          }

          if (existingBookings && existingBookings.length > 0) {
            toast.error(`Court ${courtNumber} is already booked at ${timeSlot}`);
            continue;
          }

          // First, create the booking
          const { data: bookingData, error: bookingError } = await supabase
            .from('bookings')
            .insert({
              booking_date: bookingDate.toISOString().split('T')[0],
              start_time: `${timeSlot}:00`,
              duration_hours: 1,
              number_of_courts: courtNumber,
              total_price: validPlayers.reduce((sum, p) => sum + (p.courtFees || 0), 0)
            })
            .select()
            .single();

          if (bookingError) {
            console.error('Error creating booking:', bookingError);
            toast.error(`Failed to book court ${courtNumber} at ${timeSlot}`);
            continue;
          }

          // Then, create player entries for this booking
          for (const player of validPlayers) {
            // First, ensure the player exists in the players table
            const { data: playerData, error: playerError } = await supabase
              .from('players')
              .upsert({
                name: player.name,
                email: null // Optional in schema
              })
              .select()
              .single();

            if (playerError) {
              console.error('Error creating/updating player:', playerError);
              continue;
            }

            // Then create the booking_players entry
            const { error: bookingPlayerError } = await supabase
              .from('booking_players')
              .insert({
                booking_id: bookingData.id,
                player_id: playerData.id,
                has_paid: player.paid,
                amount_due: player.courtFees || 0
              });

            if (bookingPlayerError) {
              console.error('Error creating booking player:', bookingPlayerError);
              continue;
            }
          }

          toast.success(`Booked court ${courtNumber} at ${timeSlot}`);
        }
      }

      handleNewDay(); // Reset form after successful save
    } catch (error) {
      console.error('Error saving bookings:', error);
      toast.error('Failed to save bookings');
    }
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