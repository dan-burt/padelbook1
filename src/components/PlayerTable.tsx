import React from 'react';
import { Switch } from '@headlessui/react';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/outline';

interface Player {
  name: string;
  courtFees: number | null;
  paid: boolean;
}

interface PlayerTableProps {
  players: Player[];
  onPlayersChange: (players: Player[]) => void;
}

export default function PlayerTable({ players, onPlayersChange }: PlayerTableProps) {
  const handleNameChange = (index: number, name: string) => {
    const newPlayers = [...players];
    newPlayers[index] = { ...players[index], name };
    onPlayersChange(newPlayers);
  };

  const handlePaidChange = (index: number, paid: boolean) => {
    const newPlayers = [...players];
    newPlayers[index] = { ...players[index], paid };
    onPlayersChange(newPlayers);
  };

  const addPlayer = () => {
    onPlayersChange([...players, { name: '', courtFees: null, paid: false }]);
  };

  const removePlayer = (index: number) => {
    const newPlayers = players.filter((_, i) => i !== index);
    onPlayersChange(newPlayers);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden" data-testid="players-table-container">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Players</h2>
          <button
            onClick={addPlayer}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            data-testid="add-player-button"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Player
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Court Fees
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {players.map((player, index) => (
              <tr 
                key={index} 
                className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors`}
                data-testid={`player-row-${index}`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter name"
                    value={player.name}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                    data-testid={`player-name-input-${index}`}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {player.courtFees ? `£${player.courtFees.toFixed(2)}` : '£0.00'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Switch
                    checked={player.paid}
                    onChange={(checked) => handlePaidChange(index, checked)}
                    className={`${
                      player.paid ? 'bg-green-600' : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                    data-testid={`player-paid-toggle-${index}`}
                  >
                    <span className="sr-only">Payment status</span>
                    <span
                      className={`${
                        player.paid ? 'translate-x-6 bg-white' : 'translate-x-1 bg-white'
                      } inline-block h-4 w-4 transform rounded-full transition-transform`}
                    />
                  </Switch>
                  <span className="ml-2 text-sm text-gray-500">
                    {player.paid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => removePlayer(index)}
                    className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    data-testid={`remove-player-button-${index}`}
                  >
                    <MinusIcon className="h-4 w-4 mr-1" />
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 