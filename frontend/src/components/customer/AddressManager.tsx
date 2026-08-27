'use client';

import { useState, useEffect, useCallback } from 'react';
import { Address, CreateAddressDto } from '@/types/address';
import { addressApi } from '@/lib/api/address';
import { ApiClientError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Edit2, Trash2, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddressManagerProps {
  selectable?: boolean;
  onSelect?: (addressId: string) => void;
  selectedId?: string | null;
}

export function AddressManager({ selectable = false, onSelect, selectedId }: AddressManagerProps) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CreateAddressDto>({
    type: 'HOME',
    fullName: '',
    phoneNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    isDefault: false
  });

  const loadAddresses = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await addressApi.getAddresses();
      setAddresses(res.data);
    } catch (err) {
      setError('Failed to load addresses.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAddresses();
  }, [loadAddresses]);

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (editingId) {
        await addressApi.updateAddress(editingId, formData);
      } else {
        await addressApi.createAddress(formData);
      }
      await loadAddresses();
      setIsEditing(false);
      setEditingId(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to save address.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
      setIsLoading(true);
      await addressApi.deleteAddress(id);
      await loadAddresses();
    } catch (err) {
      setError('Failed to delete address.');
      setIsLoading(false);
    }
  };

  const startEdit = (addr?: Address) => {
    if (addr) {
      setEditingId(addr.id);
      setFormData({
        type: addr.type as 'HOME' | 'WORK' | 'OTHER',
        fullName: addr.fullName,
        phoneNumber: addr.phoneNumber,
        addressLine1: addr.addressLine1,
        addressLine2: addr.addressLine2 || '',
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        isDefault: addr.isDefault
      });
    } else {
      setEditingId(null);
      setFormData({
        type: 'HOME',
        fullName: '',
        phoneNumber: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        pincode: '',
        isDefault: false
      });
    }
    setIsEditing(true);
    setError(null);
  };

  if (isLoading && !isEditing && addresses.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (isEditing) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-6">
          <h3 className="font-semibold text-lg mb-4">{editingId ? 'Edit Address' : 'Add New Address'}</h3>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>}
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} placeholder="9876543210" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Address Line 1</Label>
              <Input value={formData.addressLine1} onChange={e => setFormData({...formData, addressLine1: e.target.value})} placeholder="House/Flat No., Street" />
            </div>
            
            <div className="space-y-2">
              <Label>Address Line 2 (Optional)</Label>
              <Input value={formData.addressLine2} onChange={e => setFormData({...formData, addressLine2: e.target.value})} placeholder="Landmark, Area" />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="City" />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} placeholder="State" />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} placeholder="Pincode" />
              </div>
            </div>

            <div className="space-y-2 w-1/3">
              <Label>Address Type</Label>
              <Select value={formData.type} onValueChange={(val: string) => setFormData({...formData, type: val as 'HOME' | 'WORK' | 'OTHER'})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOME">Home</SelectItem>
                  <SelectItem value="WORK">Work</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Address
              </Button>
              <Button variant="outline" onClick={() => { setIsEditing(false); setEditingId(null); setError(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md mb-4">{error}</div>}
      
      {addresses.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <MapPin className="mx-auto h-8 w-8 text-gray-400 mb-3" />
          <h4 className="text-gray-900 font-medium">No saved addresses</h4>
          <p className="text-gray-500 text-sm mt-1 mb-4">Add an address for quick checkout.</p>
          <Button onClick={() => startEdit()} variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
            <Plus className="mr-2 h-4 w-4" /> Add Address
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map(addr => (
            <Card 
              key={addr.id} 
              className={`border-gray-200 transition-all ${selectable ? 'cursor-pointer hover:border-green-300' : ''} ${selectable && selectedId === addr.id ? 'border-green-600 bg-green-50 ring-1 ring-green-600' : ''}`}
              onClick={() => selectable && onSelect && onSelect(addr.id)}
            >
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {selectable && selectedId === addr.id && (
                      <div className="h-4 w-4 rounded-full border border-green-600 bg-green-600 flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      </div>
                    )}
                    <span className="font-semibold text-gray-900">{addr.fullName}</span>
                    <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{addr.type}</span>
                    {addr.isDefault && <span className="text-[10px] font-bold uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Default</span>}
                  </div>
                  {!selectable && (
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); startEdit(addr); }} className="text-gray-400 hover:text-green-600 transition-colors p-1">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(addr.id); }} className="text-gray-400 hover:text-red-600 transition-colors p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-600 space-y-1 ml-6">
                  <p>{addr.addressLine1}</p>
                  {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                  <p>{addr.city}, {addr.state} {addr.pincode}</p>
                  <p className="font-medium text-gray-800 pt-1">{addr.phoneNumber}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Button 
            onClick={() => startEdit()} 
            variant="outline" 
            className="h-full min-h-[150px] border-dashed flex flex-col gap-2 border-gray-300 hover:border-green-500 hover:bg-green-50/50"
          >
            <Plus className="h-6 w-6 text-green-600" />
            <span className="text-gray-600">Add New Address</span>
          </Button>
        </div>
      )}
    </div>
  );
}
