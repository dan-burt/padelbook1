import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';
import { Switch } from '@headlessui/react';
import toast from 'react-hot-toast';

type Player = Database['public']['Tables']['players']['Row'];
type Court = Database['public']['Tables']['courts']['Row'];

// Generate time slots from 7 AM to 10 PM
const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 7; // Start from 7 AM
  return {
    label: `${hour}:00`,
    value: `${hour.toString().padStart(2, '0')}:00`
  };
});

export default function BookingForm() {
  const [date, setDate] = useState<Date>(new Date());
  const [court1Active, setCourt1Active] = useState(false);
  const [court2Active, setCourt2Active] = useState(false);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [players, setPlayers] = useState<Array<{name: string, courtFees: number, paid: boolean}>>([]);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*');
    
    if (error) {
      toast.error('Error fetching players');
      return;
    }
    
    // Initialize empty player list if no data
    setPlayers([]);
  };

  const handleNewDay = () => {
    setDate(new Date());
    setCourt1Active(false);
    setCourt2Active(false);
    setSelectedTimeSlots([]);
    setPlayers([]);
  };

  const toggleTimeSlot = (timeSlot: string) => {
    setSelectedTimeSlots(prev => 
      prev.includes(timeSlot) 
        ? prev.filter(t => t !== timeSlot)
        : [...prev, timeSlot]
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex gap-4 mb-8">
        <button
          onClick={handleNewDay}
          className="px-6 py-4 border-2 border-black text-xl font-semibold hover:bg-gray-100"
        >
          New Day
        </button>

        <div className="border-2 border-black">
          <DatePicker
            selected={date}
            onChange={(date: Date | null) => date && setDate(date)}
            inline
            calendarClassName="!border-none"
          />
        </div>

        <div className="px-6 py-4 border-2 border-black flex-grow">
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

      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Available Time Slots</h3>
        <div className="grid grid-cols-8 gap-2">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot.value}
              onClick={() => toggleTimeSlot(slot.value)}
              className={`p-2 border-2 border-black rounded ${
                selectedTimeSlots.includes(slot.value) 
                  ? 'bg-blue-200' 
                  : 'hover:bg-gray-100'
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 mb-8 justify-center">
        <button
          onClick={() => setCourt1Active(!court1Active)}
          className={`w-64 h-64 border-2 border-black p-4 text-2xl font-semibold ${
            court1Active ? 'bg-blue-200' : 'hover:bg-gray-100'
          }`}
        >
          Court 1
          <br />
          Toggle
        </button>

        <button
          onClick={() => setCourt2Active(!court2Active)}
          className={`w-64 h-64 border-2 border-black p-4 text-2xl font-semibold ${
            court2Active ? 'bg-blue-200' : 'hover:bg-gray-100'
          }`}
        >
          Court 2
          <br />
          Toggle
        </button>
      </div>

      <div className="border-2 border-black">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="p-4 text-left text-xl">Name</th>
              <th className="p-4 text-left text-xl">Court Fees</th>
              <th className="p-4 text-left text-xl">Paid Toggle</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(6)].map((_, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="p-4">
                  <input
                    type="text"
                    className="w-full p-2 border rounded"
                    placeholder="Enter name"
                  />
                </td>
                <td className="p-4">
                  <input
                    type="number"
                    className="w-full p-2 border rounded"
                    placeholder="0.00"
                  />
                </td>
                <td className="p-4">
                  <Switch
                    checked={players[index]?.paid || false}
                    onChange={(checked) => {
                      const newPlayers = [...players];
                      if (!newPlayers[index]) {
                        newPlayers[index] = { name: '', courtFees: 0, paid: checked };
                      } else {
                        newPlayers[index].paid = checked;
                      }
                      setPlayers(newPlayers);
                    }}
                    className={`${
                      players[index]?.paid ? 'bg-green-600' : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 items-center rounded-full`}
                  >
                    <span className="sr-only">Paid status</span>
                    <span
                      className={`${
                        players[index]?.paid ? 'translate-x-6' : 'translate-x-1'
                      } inline-block h-4 w-4 transform rounded-full bg-white transition`}
                    />
                  </Switch>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 